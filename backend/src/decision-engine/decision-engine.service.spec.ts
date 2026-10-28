import type { ConfigService } from '@nestjs/config';
import {
  DecisionEngineService,
  type EligibilityInput,
} from './decision-engine.service';
import type { AppConfig } from '../config/configuration';

const values: Record<string, unknown> = {
  MAX_ATTEMPTS_PER_TASK: 3,
  MIN_DELAY_BETWEEN_ATTEMPTS_HOURS: 72,
  QUIET_HOURS_START: 20,
  QUIET_HOURS_END: 8,
  BUSINESS_TIMEZONE: 'Africa/Abidjan',
};
const config = {
  get: (key: string) => values[key],
} as unknown as ConfigService<AppConfig, true>;

const service = new DecisionEngineService(config);
// 10h00 à Abidjan : hors plage de silence (20h–8h).
const WORK_HOUR = new Date('2026-10-28T10:00:00Z');
const NIGHT = new Date('2026-10-28T22:30:00Z');

function base(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    taskId: 't-1',
    taskStatus: 'pending',
    attemptCount: 0,
    lastAttemptAt: null,
    motive: 'Devis DEMO-001 sans réponse depuis 10 jours, relance convenue.',
    consent: 'granted',
    identityVerified: true,
    coreAvailable: true,
    telephonyActivated: true,
    now: WORK_HOUR,
    ...overrides,
  };
}

describe('DecisionEngineService (RULE_VERSION=1.0.0)', () => {
  test('cas éligible : autorisé avec code ELIGIBLE unique', () => {
    const decision = service.evaluate(base());
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCodes).toEqual(['ELIGIBLE']);
    expect(decision.ruleVersion).toBe('1.0.0');
    expect(decision.taskId).toBe('t-1');
  });

  test.each([
    ['consentement inconnu', { consent: 'unknown' as const }, 'CONSENT_MISSING'],
    ['opposition explicite', { consent: 'refused' as const }, 'OPPOSITION_EXISTS'],
    ['consentement retiré', { consent: 'withdrawn' as const }, 'CONSENT_WITHDRAWN'],
    ['tâche déjà traitée', { taskStatus: 'done' as const }, 'TASK_NOT_ACTIONABLE'],
    ['tâche réservée ailleurs', { taskStatus: 'claimed' as const }, 'TASK_NOT_ACTIONABLE'],
    ['identité non vérifiée', { identityVerified: false }, 'IDENTITY_UNVERIFIED'],
    ['plafond atteint', { attemptCount: 3 }, 'MAX_ATTEMPTS_REACHED'],
    ['motif insuffisant', { motive: 'rappeler' }, 'MOTIVE_INSUFFICIENT'],
    ['core indisponible', { coreAvailable: false }, 'CORE_UNAVAILABLE'],
    ['téléphonie non activée', { telephonyActivated: false }, 'TELEPHONY_DISABLED'],
  ])('bloque : %s', (_label, overrides, code) => {
    const decision = service.evaluate(base(overrides));
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain(code);
  });

  test('délai minimal non respecté (1h < 72h)', () => {
    const decision = service.evaluate(
      base({ lastAttemptAt: new Date('2026-10-28T09:00:00Z') }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain('MIN_DELAY_NOT_MET');
  });

  test('délai respecté (4 jours) : pas de blocage de fréquence', () => {
    const decision = service.evaluate(
      base({ lastAttemptAt: new Date('2026-10-24T10:00:00Z'), attemptCount: 1 }),
    );
    expect(decision.reasonCodes).not.toContain('MIN_DELAY_NOT_MET');
    expect(decision.allowed).toBe(true);
  });

  test('plage de silence 22h30 Abidjan : bloqué', () => {
    const decision = service.evaluate(base({ now: NIGHT }));
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain('QUIET_HOURS');
  });

  test('configuration par défaut (manual_only) : toujours bloqué', () => {
    const decision = service.evaluate(base({ telephonyActivated: false }));
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain('TELEPHONY_DISABLED');
  });
});
