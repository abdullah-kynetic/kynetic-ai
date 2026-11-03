import { setEmailProvider } from '@/server/adapters/email';
import { ResendEmailProvider } from '@/server/adapters/email/resend';
import { getEnv, type Env } from '@/server/env';

export type EmailWiring = 'resend' | 'none';

/** Configure transactional Resend email once per server process; safe to call from app and worker boot. */
export function wireEmail(env: Env = getEnv()): EmailWiring {
  if (!env.RESEND_API_KEY) {
    setEmailProvider(undefined);
    console.log(
      JSON.stringify({ level: 'info', msg: 'email provider not configured', provider: 'none' })
    );
    return 'none';
  }

  const provider = new ResendEmailProvider({
    apiKey: env.RESEND_API_KEY,
    webhookSecret: env.RESEND_WEBHOOK_SECRET ?? ''
  });
  setEmailProvider(provider);
  console.log(
    JSON.stringify({ level: 'info', msg: 'email provider configured', provider: 'resend' })
  );
  return 'resend';
}
