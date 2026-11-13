import type { ConsentChannel, ContactDecision } from '../consent';
import type { CanContactOpts } from '../consent';

/** `tenant_modules.module_key` values (DATABASE.md). The caller names the module the send belongs to. */
export type OutboundModule =
  | 'alex_core'
  | 'quote_followup'
  | 'after_hours'
  | 'missed_call_textback'
  | 'reactivation'
  | 'opm'
  | 'crm'
  | 'followup_bundle';

export type OutboundRequest = {
  contactId: string;
  channel: ConsentChannel;
  module: OutboundModule;
  purpose?: string;
};

export type OutboundGateOpts = Pick<CanContactOpts, 'tx' | 'db' | 'stateWindows'> & {
  /**
   * The global kill switch (SECURITY 3.9). Defaults to `OUTBOUND_ENABLED` from the parsed env, which
   * is false everywhere except production. Tests and the M8b operations tools pass it explicitly.
   */
  outboundEnabled?: boolean;
  /**
   * Calls per tenant per rolling hour (SECURITY 5.4). The doc asks for this cap but gives no number,
   * so nothing is enforced until the caller supplies one.
   */
  tenantHourlyCallCap?: number;
  /**
   * Only for the one confirmation or HELP reply that answers an inbound SMS (SECURITY 3.3). Keeps
   * the kill switch, tenant, module, pause and A2P checks, and skips consent, DNC and quiet hours,
   * which a STOP has just made unsatisfiable. Never set for a send the business starts.
   */
  replyToInbound?: boolean;
  /**
   * False for a read-only preview (the compose box asking "could I send?"). Skips the blocked
   * activity rows. Defaults to true, so every real send is still logged.
   */
  audit?: boolean;
};

/** Same shape as `canContact`: allow, or one deny reason (and `retryAt` for quiet hours). */
export type GateDecision = ContactDecision;

/** Per-contact ceiling on outbound calls, regardless of `alex_configs.retry` (SECURITY 5.4). */
export const CONTACT_CALL_CAPS = { perDay: 3, perWeek: 6 } as const;
