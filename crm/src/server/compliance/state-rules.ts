import type { QuietWindow } from '../consent/quiet-hours';

// SECURITY 3.4 and 3.5: the per-state quiet-hours table and the two-party recording list are
// versioned config, not legal conclusions. Counsel has not reviewed either (SECURITY R2, Appendix B),
// so this is a conservative working draft: a state listed here only ever makes the app stricter
// (a narrower window, a call marked for review). Change the content and bump `version` together.

export type StateRules = {
  /** Recorded with the decision it shaped, so a later audit can tell which table applied. */
  version: string;
  reviewedByCounsel: boolean;
  /** Layered on the 08:00 to 21:00 default; the stricter of the two wins. Keys are two-letter states. */
  quietWindows: Record<string, QuietWindow>;
  /** Calls to contacts in these states are marked for review (F-75). The disclosure plays on every call regardless. */
  twoPartyRecordingStates: readonly string[];
};

const EIGHT_TO_EIGHT: QuietWindow = { startMinute: 8 * 60, endMinute: 20 * 60 };

export const STATE_RULES: StateRules = {
  version: '2026-10-26-draft',
  reviewedByCounsel: false,
  quietWindows: { FL: EIGHT_TO_EIGHT, MD: EIGHT_TO_EIGHT, OK: EIGHT_TO_EIGHT },
  twoPartyRecordingStates: [
    'CA',
    'CT',
    'DE',
    'FL',
    'IL',
    'MD',
    'MA',
    'MI',
    'MT',
    'NV',
    'NH',
    'OR',
    'PA',
    'WA'
  ]
};

/** The contact's two-letter state from `contacts.address`, upper-cased, or null when absent or not two letters. */
export function contactState(address: unknown): string | null {
  const state = (address as { state?: unknown } | null | undefined)?.state;
  if (typeof state !== 'string') return null;
  const s = state.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

export function isTwoPartyState(state: string | null, rules: StateRules = STATE_RULES): boolean {
  return state !== null && rules.twoPartyRecordingStates.includes(state);
}
