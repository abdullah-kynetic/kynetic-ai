import { z } from 'zod';

// Parsed once at boot. No other file reads process.env (CODE_STYLE).
// Provider keys are added by the task that first uses them.
const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_URL: z.url(),
  DATABASE_URL: z.string().startsWith('postgres'),
  DATABASE_URL_AUTH: z.string().startsWith('postgres'),
  DATABASE_URL_WORKER: z.string().startsWith('postgres').optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // Key rotation (SECURITY 4.2): bump the version with a new key and list old ones as "v:key,...".
  APP_ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  APP_ENCRYPTION_KEYS_RETIRED: z.string().optional(),
  OUTBOUND_ENABLED: booleanString.default(false)
});

export const refinedEnvSchema = envSchema.refine(
  (e) => Boolean(e.GOOGLE_CLIENT_ID) === Boolean(e.GOOGLE_CLIENT_SECRET),
  {
    message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together',
    path: ['GOOGLE_CLIENT_ID']
  }
);

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
