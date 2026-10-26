import type { CallOutcome, CallSentiment } from '@/server/calls/outcomes';

// Presentation rules for the calls list (DESIGN_SYSTEM "Chips and badges"): booked is success,
// qualified and transferred are info, DNC is error, the rest neutral. Chips always carry text.

export type OutcomeTone = 'success' | 'info' | 'neutral' | 'error';

export const OUTCOME_META: Record<CallOutcome, { label: string; tone: OutcomeTone }> = {
  booked: { label: 'Booked', tone: 'success' },
  qualified: { label: 'Qualified', tone: 'info' },
  transferred: { label: 'Transferred', tone: 'info' },
  not_interested: { label: 'Not interested', tone: 'neutral' },
  voicemail: { label: 'Voicemail', tone: 'neutral' },
  no_answer: { label: 'No answer', tone: 'neutral' },
  dnc: { label: 'Do not call', tone: 'error' },
  other: { label: 'Other', tone: 'neutral' }
};

export const SENTIMENT_LABEL: Record<CallSentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  unknown: 'Unknown'
};

const pad = (n: number) => String(n).padStart(2, '0');

/** 84 -> "1:24", 3725 -> "1:02:05". Null (call never connected) reads as a dash. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "Mon, Oct 26, 2:30 PM" in the business's time zone, so it reads the way staff expect. */
export function formatCallTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone
  });
}

export type CallsQueryState = {
  outcome?: string;
  direction?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

/** Filter state lives in the URL so views are shareable and survive a reload (DESIGN_SYSTEM data table). */
export function callsHref(state: CallsQueryState): string {
  const params = new URLSearchParams();
  if (state.outcome) params.set('outcome', state.outcome);
  if (state.direction) params.set('direction', state.direction);
  if (state.from) params.set('from', state.from);
  if (state.to) params.set('to', state.to);
  if (state.pageSize && state.pageSize !== 20) params.set('pageSize', String(state.pageSize));
  if (state.page && state.page > 1) params.set('page', String(state.page));
  const qs = params.toString();
  return qs ? `/dashboard/calls?${qs}` : '/dashboard/calls';
}

/** Pagination footer text: "21-40 of 134". */
export function rangeLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return '0 of 0';
  const start = (page - 1) * pageSize + 1;
  return `${start}-${Math.min(page * pageSize, total)} of ${total}`;
}
