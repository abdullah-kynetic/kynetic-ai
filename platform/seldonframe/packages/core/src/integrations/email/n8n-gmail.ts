import type { IntegrationAdapter } from "../types";
import { hasEnv, simpleHealthCheck } from "../helpers";

export type N8nGmailConfig = {
  fromEmail?: string;
};

let activeConfig: N8nGmailConfig | null = null;

export const n8nGmailAdapter: IntegrationAdapter<N8nGmailConfig> = {
  name: "n8n-gmail",
  isConfigured() {
    return hasEnv("N8N_EMAIL_WEBHOOK_URL", "N8N_EMAIL_WEBHOOK_HEADER_NAME", "N8N_EMAIL_WEBHOOK_HEADER_VALUE");
  },
  initialize(config) {
    activeConfig = config;
  },
  async healthCheck() {
    return simpleHealthCheck(Boolean(activeConfig) || this.isConfigured());
  },
};
