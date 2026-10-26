import { z } from 'zod';

// Parsed once at boot. No other file reads process.env (CODE_STYLE).
// Provider keys are added by the task that first uses them.
const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_URL: z.url(),
  DATABASE_URL: z.string().startsWith('postgres'),
  DATABASE_URL_WORKER: z.string().startsWith('postgres').optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().min(32),
  OUTBOUND_ENABLED: booleanString.default(false)
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
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
