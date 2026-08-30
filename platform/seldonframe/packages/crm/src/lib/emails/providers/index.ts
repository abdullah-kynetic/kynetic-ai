import { findAdapterById } from "@seldonframe/core/integrations";
import { resendProvider } from "./resend";
import { n8nGmailProvider } from "./n8n-gmail";
import type { EmailProvider } from "./interface";

export { resendProvider } from "./resend";
export { n8nGmailProvider } from "./n8n-gmail";
export type {
  EmailProvider,
  EmailSendRequest,
  EmailSendResult,
  EmailSendFailure,
  EmailAttachment,
} from "./interface";
export { EmailProviderSendError } from "./interface";

// Provider registry keyed by id. The interface is deliberately small so
// adding a new provider is a new file + one registry entry.
//
// 2026-08-30 — n8n-gmail is now the preferred provider for product email
// (see emailProviderOrder below); resend stays registered because auth
// magic-link login (lib/auth/config.ts) is wired to it independently of
// this registry and unaffected by the order here.
export const emailProviders: Record<string, EmailProvider> = {
  "n8n-gmail": n8nGmailProvider,
  resend: resendProvider,
};

export function getEmailProvider(id: string): EmailProvider | null {
  return emailProviders[id] ?? null;
}

// Discovery order for picking a default when no override is supplied.
// n8n-gmail is preferred (routes through the agency's own Gmail); resend is
// the fallback for workspaces that haven't set up the n8n webhook.
export const emailProviderOrder = ["n8n-gmail", "resend", "sendgrid", "postmark"] as const;

export type EmailProviderId = (typeof emailProviderOrder)[number] | "manual";

export async function getAvailableEmailProviders() {
  const checks = await Promise.all(
    emailProviderOrder.map(async (id) => {
      const descriptor = await findAdapterById(id);
      return descriptor && descriptor.adapter.isConfigured() ? id : null;
    })
  );

  return checks.filter((item): item is (typeof emailProviderOrder)[number] => Boolean(item));
}

export async function resolveEmailProvider(requested?: string | null): Promise<EmailProviderId> {
  const available = await getAvailableEmailProviders();

  if (requested && available.includes(requested as (typeof emailProviderOrder)[number])) {
    return requested as EmailProviderId;
  }

  if (available.includes("n8n-gmail")) {
    return "n8n-gmail";
  }

  if (available.includes("resend")) {
    return "resend";
  }

  return available[0] ?? "manual";
}

export function resolveDefaultFromEmail() {
  return process.env.DEFAULT_FROM_EMAIL ?? "hello@seldonframe.local";
}
