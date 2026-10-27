// Maps provider wording onto the closed sets the `calls` CHECK constraints allow (DATABASE.md).
// Provider text is untrusted (SECURITY 3.6): anything unknown becomes `other` or `unknown`.

export const CALL_OUTCOMES = [
  'booked',
  'qualified',
  'not_interested',
  'voicemail',
  'no_answer',
  'transferred',
  'dnc',
  'other'
] as const;
export const CALL_SENTIMENTS = ['positive', 'neutral', 'negative', 'unknown'] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export type CallSentiment = (typeof CALL_SENTIMENTS)[number];

const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/** `failed:<reason>` is how an adapter reports a call that never connected. */
export function normalizeOutcome(raw: string | undefined): CallOutcome {
  if (!raw) return 'other';
  const v = slug(raw);
  if ((CALL_OUTCOMES as readonly string[]).includes(v)) return v as CallOutcome;
  if (v.startsWith('failed:')) {
    const reason = v.slice('failed:'.length);
    return reason === 'busy' || reason === 'no_answer' ? 'no_answer' : 'other';
  }
  return 'other';
}

export function normalizeSentiment(raw: string | undefined): CallSentiment | null {
  if (!raw) return null;
  const v = slug(raw);
  return (CALL_SENTIMENTS as readonly string[]).includes(v) ? (v as CallSentiment) : 'unknown';
}

export function outcomeLabel(outcome: CallOutcome): string {
  const labels: Record<CallOutcome, string> = {
    booked: 'booked an appointment',
    qualified: 'qualified',
    not_interested: 'not interested',
    voicemail: 'left a voicemail',
    no_answer: 'no answer',
    transferred: 'transferred to the team',
    dnc: 'asked not to be called again',
    other: 'ended'
  };
  return labels[outcome];
}
