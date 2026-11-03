/** Protected office number from docs/decisions.md D-016. Never a dial/test destination. */
export const NEVER_DIAL_NUMBERS = new Set(['+15413883621']);
export const US_STATE_CODES =
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' '
  );
export const SYNTHETIC_PHONE = /^\+1[2-9]\d{2}55501\d{2}$/;
export const DEFAULT_DIALER_SCRIPT =
  'Draft for review: Hi, this is [your name] with Kynetic AI. Is now a good time for a quick question about how you handle new leads?';

export type DialerCandidate = {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  primaryPhoneE164: string | null;
  phones: string[];
  address: unknown;
  source: string | null;
  doNotCallAt: string | null;
};
export function dialerBlockReason(
  contact: DialerCandidate,
  activeDnc: ReadonlySet<string>,
  phoneOptOut: boolean
): string | null {
  const numbers = [contact.primaryPhoneE164, ...contact.phones].filter((v): v is string => !!v);
  const identity = `${contact.firstName} ${contact.lastName ?? ''} ${contact.companyName ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (numbers.some((p) => NEVER_DIAL_NUMBERS.has(p)) || identity.includes('am1roofing'))
    return 'protected_business';
  if (contact.doNotCallAt || phoneOptOut || numbers.some((p) => activeDnc.has(p))) return 'dnc';
  const address = contact.address as { state?: unknown; region?: unknown } | null;
  const states = [address?.state, address?.region]
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().toUpperCase());
  if (states.some((s) => ['FL', 'FLORIDA', 'OK', 'OKLAHOMA'].includes(s))) return 'excluded_state';
  const state = states.find((s) => US_STATE_CODES.includes(s));
  if (!state || states.some((s) => s !== state)) return 'unknown_state';
  if (contact.source !== 'agency_outbound_cold_call') return 'not_phone_queue';
  if (!contact.primaryPhoneE164) return 'missing_phone';
  // This workspace is synthetic; even a malformed/imported real number must never be displayed.
  if (!numbers.every((p) => SYNTHETIC_PHONE.test(p))) return 'non_synthetic_phone';
  return null;
}
