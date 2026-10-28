import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { BlokCoreClient } from '../core-integration/blok-core.client';
import { DecisionEngineService } from '../decision-engine/decision-engine.service';
import { OutreachTasksService } from '../outreach-tasks/outreach-tasks.service';
import { TelephonySafetyService } from '../telephony/telephony-safety.service';
import { VoiceConsentsService } from '../voice-consents/voice-consents.service';
import { CallAttemptsService } from '../call-attempts/call-attempts.service';
import type { AppConfig } from '../config/configuration';

/**
 * Balayage périodique des tâches échues : réévalue l'éligibilité, journalise,
 * signale les dossiers bloqués. NE compose JAMAIS d'appel, NE réserve JAMAIS
 * de tâche pour appel, NE contourne JAMAIS une opposition.
 * (Compatible ultérieurement avec BullMQ ; voir docs/architecture.md.)
 */
@Injectable()
export class DueTasksScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly tasks: OutreachTasksService,
    private readonly consents: VoiceConsentsService,
    private readonly engine: DecisionEngineService,
    private readonly audit: AuditService,
    private readonly telephony: TelephonySafetyService,
    private readonly core: BlokCoreClient,
    private readonly attempts: CallAttemptsService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('SCHEDULER_ENABLED', { infer: true })) return;
    const interval = this.config.get('SCHEDULER_INTERVAL_MS', { infer: true });
    this.timer = setInterval(() => {
      void this.sweep().catch(() => undefined);
    }, interval);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(now = new Date()): Promise<{ examined: number; blocked: number }> {
    const due = await this.tasks.list({ status: 'pending', dueBefore: now, limit: 100 });
    let blocked = 0;
    for (const task of due) {
      const consent = await this.consents.getStatus(task.customerRef);
      const attempts = await this.attempts.listForTask(task.id);
      const last = attempts.length > 0 ? attempts[attempts.length - 1]!.createdAt : null;
      const decision = this.engine.evaluate({
        taskId: task.id,
        taskStatus: task.status,
        attemptCount: task.attemptCount,
        lastAttemptAt: last,
        motive: task.motive,
        consent,
        identityVerified: false, // Le balayage ne vérifie pas l'identité : il ne fait que signaler.
        coreAvailable: !this.core.isMockMode(),
        telephonyActivated: await this.telephony.isActivated(),
        now,
      });
      await this.audit.logDecision({
        taskId: task.id,
        decision: decision.allowed ? 'allow' : 'block',
        evaluatedAt: new Date(decision.evaluatedAt),
        ruleVersion: decision.ruleVersion,
        reasonCodes: decision.reasonCodes,
        facts: decision.facts,
        requestedBy: 'scheduler',
      });
      await this.tasks.saveEvaluation(task.id, {
        allowed: decision.allowed,
        reasonCodes: decision.reasonCodes,
        ruleVersion: decision.ruleVersion,
        evaluatedAt: decision.evaluatedAt,
      });
      // Opposition constatée au balayage : la tâche passe en bloqué (transition autorisée).
      if (decision.reasonCodes.includes('OPPOSITION_EXISTS')) {
        await this.tasks.transition(task.id, 'blocked', 'scheduler');
        blocked += 1;
      }
    }
    return { examined: due.length, blocked };
  }
}
