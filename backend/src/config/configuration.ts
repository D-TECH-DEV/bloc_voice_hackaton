import { z } from 'zod';

/**
 * Validation centralisée des variables d'environnement.
 * Échoue vite au démarrage plutôt qu'en pleine relance.
 * Aucune valeur par défaut n'active un comportement dangereux.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().default('blok_relance'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('blok_relance'),
  DB_NAME_TEST: z.string().default('blok_relance_test'),
  CORE_API_BASE_URL: z
    .string()
    .default('https://core-api-dev.blok.africa/api/external'),
  CORE_API_KEY: z.string().default(''),
  CORE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  MOCK_CORE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ENABLE_CORE_WRITES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  VOICE_TOOL_SECRET: z.string().default(''),
  OPERATOR_ADMIN_TOKEN: z.string().default(''),
  OPERATOR_SALES_TOKEN: z.string().default(''),
  BUSINESS_TIMEZONE: z.string().default('Africa/Abidjan'),
  MAX_ATTEMPTS_PER_TASK: z.coerce.number().int().min(1).default(3),
  MIN_DELAY_BETWEEN_ATTEMPTS_HOURS: z.coerce.number().min(1).default(72),
  QUIET_HOURS_START: z.coerce.number().int().min(0).max(23).default(20),
  QUIET_HOURS_END: z.coerce.number().int().min(0).max(23).default(8),
  OUTBOUND_CALLS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SCHEDULER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(5000).default(60000),
  NODE_ENV: z.string().default('development'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfiguration(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuration invalide : ${details}`);
  }
  return parsed.data;
}

/** Le système fonctionne en mode manuel tant que la téléphonie n'est pas doublement activée. */
export function describeOperatingMode(config: AppConfig): 'manual_only' | 'assisted' {
  return config.OUTBOUND_CALLS_ENABLED ? 'assisted' : 'manual_only';
}
