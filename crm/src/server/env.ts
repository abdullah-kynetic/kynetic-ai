import { z } from 'zod';

// Parsed once at boot. No other file reads process.env (CODE_STYLE).
// Provider keys are added by the task that first uses them.
const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEV_PERSONA_SWITCHING: booleanString.default(false),
  // Dev-only validation happens at the dev boundary; unrelated production paths do not use it.
  TEST_PHONE: z.string().optional(),
  APP_BASE_URL: z.url(),
  DATABASE_URL: z.string().startsWith('postgres'),
  DATABASE_URL_AUTH: z.string().startsWith('postgres'),
  DATABASE_URL_WORKER: z.string().startsWith('postgres').optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().min(32),
  BACKUP_ENCRYPTION_KEY: z.string().min(32).optional(),
  DATABASE_URL_BACKUP: z.string().startsWith('postgres').optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // Key rotation (SECURITY 4.2): bump the version with a new key and list old ones as "v:key,...".
  APP_ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  APP_ENCRYPTION_KEYS_RETIRED: z.string().optional(),
  // M13-02: real ElevenLabs selection requires an explicit opt-in, even when keys exist.
  ELEVENLABS_LIVE_ENABLED: booleanString.default(false),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_WEBHOOK_SECRET: z.string().min(1).optional(),
  ELEVENLABS_AGENT_PHONE_NUMBER_ID: z.string().min(1).optional(),
  RETELL_API_KEY: z.string().min(1).optional(),
  RETELL_FROM_NUMBER: z.string().min(1).optional(),
  OUTBOUND_ENABLED: booleanString.default(false),
  // Staff failure alerts and the daily admin digest. In-app notices still appear when this is off.
  ADMIN_ALERT_EMAIL_ENABLED: booleanString.default(false),
  // Weekly client email and the monthly report link. Both also need the per-client toggle.
  CLIENT_EMAIL_ENABLED: booleanString.default(false),
  // `stub` is an explicit deployment/test setting; default live mode keeps production fail-closed.
  PROVIDER_MODE: z.enum(['live', 'stub']).default('live'),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Verified sending address for app email (ARCHITECTURE: Domain, DNS and email domain).
  EMAIL_FROM_ADDRESS: z.string().min(3).default('notifications@mail.kyneticai.com'),
  // Object storage (R2). All four are set together; see refinedEnvSchema.
  STORAGE_ENDPOINT: z.url().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_REGION: z.string().min(1).optional(),
  // Twilio (M4-08). Optional so preview and tests run on the fake; the real provider needs both.
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional()
});

const STORAGE_KEYS = [
  'STORAGE_ENDPOINT',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'STORAGE_BUCKET'
] as const;

export const refinedEnvSchema = envSchema
  .refine((e) => Boolean(e.GOOGLE_CLIENT_ID) === Boolean(e.GOOGLE_CLIENT_SECRET), {
    message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together',
    path: ['GOOGLE_CLIENT_ID']
  })
  .refine((e) => Boolean(e.TWILIO_ACCOUNT_SID) === Boolean(e.TWILIO_AUTH_TOKEN), {
    message: 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set together',
    path: ['TWILIO_ACCOUNT_SID']
  })
  .refine((e) => STORAGE_KEYS.every((k) => Boolean(e[k])) || STORAGE_KEYS.every((k) => !e[k]), {
    message:
      'STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY and STORAGE_BUCKET must be set together',
    path: ['STORAGE_ENDPOINT']
  })
  .refine((e) => e.PROVIDER_MODE !== 'stub' || !e.OUTBOUND_ENABLED, {
    message: 'PROVIDER_MODE=stub requires OUTBOUND_ENABLED=false',
    path: ['PROVIDER_MODE']
  })
  .transform((value) => ({
    ...value,
    DEV_PERSONA_SWITCHING: value.NODE_ENV !== 'production' && value.DEV_PERSONA_SWITCHING
  }));

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = refinedEnvSchema.safeParse(source);
  if (!result.success) {
    // Names and reasons only; never echo values.
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration: ${problems.join('; ')}`);
  }
  return result.data;
}

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Tests that flip PROVIDER_MODE need a fresh parse. Production calls never use this. */
export function resetEnvCacheForTests(): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('resetEnvCacheForTests is test-only');
  cached = undefined;
}
