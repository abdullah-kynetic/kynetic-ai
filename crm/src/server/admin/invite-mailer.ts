import type { EmailProvider } from '../adapters/email/types';

export type InviteMailer = { provider: EmailProvider; fromAddress: string };

let mailer: InviteMailer | undefined;

/** Wired at boot to the app email provider (Resend, M4-09). Until then the invite cannot be sent. */
export function setInviteMailer(m: InviteMailer | undefined): void {
  mailer = m;
}

export function getInviteMailer(): InviteMailer | undefined {
  return mailer;
}
