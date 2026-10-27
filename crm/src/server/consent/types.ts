import type { Db, Tx } from '../db/client';

/** Channel names as stored in `consents.channel` (DATABASE.md; SECURITY.md calls phone_call "voice"). */
export const CONSENT_CHANNELS = ['phone_call', 'sms', 'email'] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

/** Every reason the compliance gate can give (SECURITY 3.1). Only some are decided in canContact. */
export type DenyReason =
  | 'no_consent'
  | 'consent_revoked'
  | 'opted_out'
  | 'internal_dnc'
  | 'quiet_hours'
  | 'unknown_timezone'
  // Decided by OutboundGate (M0-18, M4), not here:
  | 'module_off'
  | 'tenant_suspended'
  | 'alex_paused'
  | 'outbound_disabled'
  | 'sms_not_approved'
  | 'rate_cap';

export type ContactDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: DenyReason;
      /** Quiet-hours denials only: when the contact window next opens. The caller reschedules to it. */
      retryAt?: Date;
    };

/** Run inside an existing transaction (`tx`), or let the helper open one with `withTenant`. */
export type ConsentRunOpts = { tx?: Tx; db?: Db };
