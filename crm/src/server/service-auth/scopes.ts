/** Routes that accept a service token, plus the short allowlist in SECURITY 2.3 item 9. */
export const SERVICE_TOKEN_SCOPES = [
  'create-contact',
  'update-deal-stage',
  'event-ack',
  'contacts:read',
  'appointments:read',
  'appointments:write',
  'calls:write',
  'contact-decisions:write',
  'contact-policy:read',
  'send-state:read'
] as const;

export type ServiceTokenScope = (typeof SERVICE_TOKEN_SCOPES)[number];
