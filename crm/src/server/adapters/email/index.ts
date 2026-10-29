import type { EmailProvider } from './types';

export type { EmailProvider, SendEmailInput, VerifiedEmailEvent } from './types';

// Kept on globalThis: Next.js loads instrumentation and route handlers as separate module graphs,
// so a plain module variable set at boot would not be seen by request handlers.
const KEY = Symbol.for('kynetic.emailProvider');
type Slot = { [KEY]?: EmailProvider };

/** Wired at boot to the Resend provider (M4-09), or the fake in tests. */
export function setEmailProvider(p: EmailProvider | undefined): void {
  (globalThis as Slot)[KEY] = p;
}

export function getEmailProvider(): EmailProvider {
  const provider = (globalThis as Slot)[KEY];
  if (!provider) throw new Error('No email provider is configured');
  return provider;
}
