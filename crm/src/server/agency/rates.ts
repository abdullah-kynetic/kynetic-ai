export type RateMessage = { contactId: string; direction: string; at: string };
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
