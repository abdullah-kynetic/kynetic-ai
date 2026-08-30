import {
  EmailProviderSendError,
  type EmailProvider,
  type EmailSendRequest,
  type EmailSendResult,
} from "./interface";

// 2026-08-30 — sends CRM product emails (booking confirmations, portal
// invites, client notifications) through an n8n workflow that calls Gmail,
// instead of Resend. Login/magic-link auth stays on Resend (lib/auth/config.ts) —
// deliberately NOT routed here, since making the login path depend on an
// external n8n instance would turn a slow/down n8n into a total login outage.
//
// The n8n workflow (webhook -> normalize -> Gmail send -> respond) is
// header-auth protected; the shared secret lives in both this env config and
// the webhook's n8n credential, never in code.
const WEBHOOK_URL = process.env.N8N_EMAIL_WEBHOOK_URL?.trim();
const HEADER_NAME = process.env.N8N_EMAIL_WEBHOOK_HEADER_NAME?.trim();
const HEADER_VALUE = process.env.N8N_EMAIL_WEBHOOK_HEADER_VALUE?.trim();

type N8nWebhookResponse = {
  ok: boolean;
  externalMessageId?: string;
  provider?: string;
  reason?: string;
};

export const n8nGmailProvider: EmailProvider = {
  id: "n8n-gmail",

  async isConfigured() {
    return Boolean(WEBHOOK_URL && HEADER_NAME && HEADER_VALUE);
  },

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    if (!WEBHOOK_URL || !HEADER_NAME || !HEADER_VALUE) {
      throw new EmailProviderSendError("n8n-gmail", "n8n Gmail webhook not configured", {
        retriable: false,
      });
    }

    const doFetch = request.fetcher ?? fetch;

    const response = await doFetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        [HEADER_NAME]: HEADER_VALUE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orgId: request.orgId,
        from: request.from,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
      }),
    });

    if (!response.ok) {
      const retriable = response.status >= 500 || response.status === 429;
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = await response.text();
      }
      throw new EmailProviderSendError("n8n-gmail", `n8n Gmail send failed with ${response.status}`, {
        retriable,
        details,
      });
    }

    const payload = (await response.json()) as N8nWebhookResponse;
    if (!payload.ok || !payload.externalMessageId) {
      throw new EmailProviderSendError("n8n-gmail", payload.reason ?? "n8n Gmail send did not confirm success", {
        retriable: false,
        details: payload,
      });
    }

    return { externalMessageId: payload.externalMessageId, provider: "n8n-gmail" };
  },
};
