import type { EmailProvider } from './types';

export type { EmailProvider, SendEmailInput, VerifiedEmailEvent } from './types';

let provider: EmailProvider | undefined;

/** Wired at boot to the Resend provider (M4-09), or the fake in tests. */
export function setEmailProvider(p: EmailProvider | undefined): void {
  provider = p;
}

export function getEmailProvider(): EmailProvider {
  if (!provider) throw new Error('No email provider is configured');
  return provider;
}
