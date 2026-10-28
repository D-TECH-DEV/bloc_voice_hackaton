import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import type { ConsentStatus } from '../entities/voice-consent.entity';
import type { TaskStatus } from '../entities/outreach-task.entity';

export const RULE_VERSION = '1.0.0';

export type ReasonCode =
  | 'TASK_NOT_ACTIONABLE'
  | 'OPPOSITION_EXISTS'
  | 'CONSENT_WITHDRAWN'
  | 'CONSENT_MISSING'
  | 'IDENTITY_UNVERIFIED'
  | 'MAX_ATTEMPTS_REACHED'
  | 'MIN_DELAY_NOT_MET'
  | 'QUIET_HOURS'
  | 'MOTIVE_INSUFFICIENT'
  | 'CORE_UNAVAILABLE'
  | 'TELEPHONY_DISABLED'
  | 'ELIGIBLE';

export type ConsentSight = ConsentStatus | 'unknown';

export interface EligibilityInput {
  taskId: string;
  taskStatus: TaskStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
  motive: string;
  consent: ConsentSight;
  /** Identité et numéro vérifiés par une source fiable (jamais le seul dire de l'agent). */
  identityVerified: boolean;
  /** Faux quand une vérification obligatoire dépend d'un service en panne. */
  coreAvailable: boolean;
  /** Double verrou téléphonie (config + activation en base). */
  telephonyActivated: boolean;
  now: Date;
}

export interface EligibilityDecision {
  allowed: boolean;
  reasonCodes: ReasonCode[];
  ruleVersion: string;
  evaluatedAt: string;
  taskId: string;
  facts: Record<string, unknown>;
}

/**
 * Moteur de règles pur (aucune I/O) : testable, versionné, déterministe.
 * En cas de doute, bloque. L'ordre des règles est stable pour l'audit.
 */
@Injectable()
export class DecisionEngineService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  evaluate(input: EligibilityInput): EligibilityDecision {
    const codes: ReasonCode[] = [];
    const facts: Record<string, unknown> = {};
    const maxAttempts = this.config.get('MAX_ATTEMPTS_PER_TASK', { infer: true });
    const minDelayH = this.config.get('MIN_DELAY_BETWEEN_ATTEMPTS_HOURS', { infer: true });
    facts['maxAttempts'] = maxAttempts;
    facts['minDelayHours'] = minDelayH;
    facts['attemptCount'] = input.attemptCount;
    facts['taskStatus'] = input.taskStatus;
    facts['consent'] = input.consent;

    if (input.taskStatus !== 'pending') codes.push('TASK_NOT_ACTIONABLE');
    if (input.consent === 'refused') codes.push('OPPOSITION_EXISTS');
    else if (input.consent === 'withdrawn') codes.push('CONSENT_WITHDRAWN');
    else if (input.consent !== 'granted') codes.push('CONSENT_MISSING');
    if (!input.identityVerified) codes.push('IDENTITY_UNVERIFIED');
    if (input.attemptCount >= maxAttempts) codes.push('MAX_ATTEMPTS_REACHED');
    if (input.lastAttemptAt) {
      const elapsedH =
        (input.now.getTime() - input.lastAttemptAt.getTime()) / 3_600_000;
      facts['hoursSinceLastAttempt'] = Math.round(elapsedH * 100) / 100;
      if (elapsedH < minDelayH) codes.push('MIN_DELAY_NOT_MET');
    }
    if (this.isQuietHour(input.now)) {
      codes.push('QUIET_HOURS');
      facts['businessTimezone'] = this.config.get('BUSINESS_TIMEZONE', { infer: true });
    }
    if (input.motive.trim().length < 10) codes.push('MOTIVE_INSUFFICIENT');
    if (!input.coreAvailable) codes.push('CORE_UNAVAILABLE');
    if (!input.telephonyActivated) codes.push('TELEPHONY_DISABLED');

    const allowed = codes.length === 0;
    return {
      allowed,
      reasonCodes: allowed ? ['ELIGIBLE'] : codes,
      ruleVersion: RULE_VERSION,
      evaluatedAt: input.now.toISOString(),
      taskId: input.taskId,
      facts,
    };
  }

  private isQuietHour(now: Date): boolean {
    const tz = this.config.get('BUSINESS_TIMEZONE', { infer: true });
    // fr-FR rend « 22 h » : on extrait les chiffres (00–23 attendus).
    const formatted = new Intl.DateTimeFormat('fr-FR', {
      hour: 'numeric',
      hour12: false,
      timeZone: tz,
    }).format(now);
    const hour = Number((formatted.match(/\d+/) ?? ['-1'])[0]);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return true; // Doute = silence.
    const start = this.config.get('QUIET_HOURS_START', { infer: true });
    const end = this.config.get('QUIET_HOURS_END', { infer: true });
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end; // Plage à cheval sur minuit (défaut 20h–8h).
  }
}
