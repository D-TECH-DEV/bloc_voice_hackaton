import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DecisionLog, type Decision } from '../entities/decision-log.entity';
import { OperatorAction } from '../entities/operator-action.entity';

/** Journal d'audit : décisions moteur + actions sensibles des opérateurs. */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(DecisionLog)
    private readonly decisions: Repository<DecisionLog>,
    @InjectRepository(OperatorAction)
    private readonly actions: Repository<OperatorAction>,
  ) {}

  async logDecision(input: {
    taskId?: string;
    attemptId?: string;
    decision: Decision;
    evaluatedAt: Date;
    ruleVersion: string;
    reasonCodes: string[];
    facts?: Record<string, unknown>;
    requestedBy: string;
  }): Promise<DecisionLog> {
    return this.decisions.save(
      this.decisions.create({
        taskId: input.taskId ?? null,
        attemptId: input.attemptId ?? null,
        decision: input.decision,
        evaluatedAt: input.evaluatedAt,
        ruleVersion: input.ruleVersion,
        reasonCodes: input.reasonCodes,
        facts: input.facts ?? null,
        requestedBy: input.requestedBy,
      }),
    );
  }

  async logOperatorAction(
    actor: string,
    action: string,
    target?: string,
    detail?: Record<string, unknown>,
  ): Promise<OperatorAction> {
    return this.actions.save(
      this.actions.create({ actor, action, target: target ?? null, detail: detail ?? null }),
    );
  }

  async decisionsForTask(taskId: string): Promise<DecisionLog[]> {
    return this.decisions.find({ where: { taskId }, order: { evaluatedAt: 'DESC' } });
  }

  async recentDecisions(limit = 100): Promise<DecisionLog[]> {
    return this.decisions.find({
      order: { evaluatedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
