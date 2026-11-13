import type { DenyReason } from '../consent';

/** Reasons the compose box can show beyond the gate's own list. */
export type ComposeBlockReason =
  | DenyReason
  | 'no_address'
  | 'email_suppressed'
  | 'email_not_set_up';

const NAMES: Record<string, string> = { sms: 'text', email: 'email' };

/**
 * Plain wording for why a message cannot go out. The client reads this next to the compose box, so
 * it says what is true and what to do, and never shows a reason code.
 */
export function describeBlock(
  reason: ComposeBlockReason,
  channel: 'sms' | 'email',
  retryAt?: Date,
  timeZone?: string
): string {
  const what = NAMES[channel];
  switch (reason) {
    case 'no_consent':
      return `This person has not agreed to get ${what} messages from you, so the portal will not send one.`;
    case 'consent_revoked':
      return `This person's consent to ${what} messages was withdrawn. Do not contact them this way.`;
    case 'opted_out':
      return `This person opted out of ${what} messages. They have to opt back in before you can send one.`;
    case 'internal_dnc':
      return 'This person is on the do-not-contact list, so no message can be sent.';
    case 'quiet_hours': {
      const when = retryAt
        ? ` It can go out after ${retryAt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: timeZone ?? 'UTC',
            timeZoneName: 'short'
          })}.`
        : '';
      return `It is outside the allowed hours to text this person.${when}`;
    }
    case 'unknown_timezone':
      return "We do not know this person's time zone, so we cannot tell whether it is a safe hour to text.";
    case 'sms_not_approved':
      return 'Texting is not approved for your business number yet, so texts cannot be sent.';
    case 'outbound_disabled':
    case 'global_pause':
    case 'tenant_kill':
      return 'Sending is switched off for now. Nothing leaves the portal until Kynetic turns it on.';
    case 'module_off':
      return 'Messaging is not part of your plan.';
    case 'tenant_suspended':
      return 'Your account is paused, so messages cannot be sent.';
    case 'alex_paused':
      return 'Messaging is paused on your account.';
    case 'spend_cap':
    case 'rate_cap':
      return 'A sending limit was reached. Try again later.';
    case 'no_address':
      return channel === 'sms'
        ? 'This contact has no phone number on file.'
        : 'This contact has no email address on file.';
    case 'email_suppressed':
      return 'Email to this address bounced or was marked as spam, so it is blocked.';
    case 'email_not_set_up':
      return 'Email sending is not set up yet.';
  }
}
