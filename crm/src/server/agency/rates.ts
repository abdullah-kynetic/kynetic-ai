export type RateMessage = { contactId: string; direction: string; at: string };
export type DatedOutcome = { outcome: string; at: string };
export type RateSeriesPoint = {
  day: string;
  pickRate: number | null;
  replyRate: number | null;
};

/** Pacific-date day key (YYYY-MM-DD), matching the finance month convention. */
export function pacificDay(at: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(typeof at === 'string' ? new Date(at) : at);
}

export function seriesDays(count: number, now = new Date()): string[] {
  const days: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    days.push(pacificDay(new Date(now.getTime() - index * 86400000)));
  }
  return days;
}

/**
 * Per-day pick and reply rates across the last `count` days (oldest first).
 * Each day reuses the same answered-outcome and reply-after-outreach rules as
 * `agencyRates`; a day with no attempts or outreach reports null, not zero.
 */
export function dailyRateSeries(
  outcomes: readonly DatedOutcome[],
  messages: readonly RateMessage[],
  count = 30,
  now = new Date()
): RateSeriesPoint[] {
  const days = seriesDays(count, now);
  const byDay = new Map<string, { outcomes: string[]; messages: RateMessage[] }>(
    days.map((day) => [day, { outcomes: [], messages: [] }])
  );
  for (const { outcome, at } of outcomes) {
    const bucket = byDay.get(pacificDay(at));
    if (bucket) bucket.outcomes.push(outcome);
  }
  for (const message of messages) {
    const bucket = byDay.get(pacificDay(message.at));
    if (bucket) bucket.messages.push(message);
  }
  return days.map((day) => {
    const rates = agencyRates(byDay.get(day)!.outcomes, byDay.get(day)!.messages);
    return { day, pickRate: rates.pickRate, replyRate: rates.replyRate };
  });
}

export function agencyRates(outcomes: readonly string[], messages: readonly RateMessage[]) {
  const answered = new Set([
    'connected',
    'interested',
    'not_interested',
    'callback',
    'dnc',
    'booked',
    'qualified',
    'transferred'
  ]);
  const picked = outcomes.filter((o) => answered.has(o)).length;
  const first = new Map<string, number>();
  for (const m of messages)
    if (m.direction === 'outbound') {
      const at = Date.parse(m.at);
      first.set(m.contactId, Math.min(first.get(m.contactId) ?? Infinity, at));
    }
  const replied = new Set(
    messages
      .filter(
        (m) => m.direction === 'inbound' && Date.parse(m.at) > (first.get(m.contactId) ?? Infinity)
      )
      .map((m) => m.contactId)
  );
  return {
    attempted: outcomes.length,
    picked,
    pickRate: outcomes.length ? picked / outcomes.length : null,
    contacted: first.size,
    replied: replied.size,
    replyRate: first.size ? replied.size / first.size : null
  };
}
export function percent(value: number | null) {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}
