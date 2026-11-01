import { createHash } from 'node:crypto';
import { setEmailProvider } from '@/server/adapters/email';
import { ResendEmailProvider } from '@/server/adapters/email/resend';
import { setMagicLinkSender } from '@/server/auth';
import { getEnv, type Env } from '@/server/env';

export type EmailWiring = 'resend' | 'none';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** Configure transactional Resend email once per server process; safe to call from app and worker boot. */
export function wireEmail(env: Env = getEnv()): EmailWiring {
  if (!env.RESEND_API_KEY) {
    setEmailProvider(undefined);
    setMagicLinkSender(undefined);
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
  setMagicLinkSender(async ({ email, url }) => {
    await provider.send({
      tenantId: 'platform',
      to: email,
      fromName: 'Kynetic AI',
      fromAddress: env.EMAIL_FROM_ADDRESS,
      subject: 'Your Kynetic sign-in link',
      html: `<p>Use the link below to sign in. It expires in 15 minutes.</p><p><a href="${escapeHtml(url)}">Sign in to Kynetic AI</a></p>`,
      text: `Use this link to sign in to Kynetic AI. It expires in 15 minutes: ${url}`,
      idempotencyKey: `magic-link:${createHash('sha256').update(url).digest('hex')}`
    });
  });
  console.log(
    JSON.stringify({ level: 'info', msg: 'email provider configured', provider: 'resend' })
  );
  return 'resend';
}
