/** Presentation-only labels. Stored values and action payloads remain unchanged. */
export function agencyDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium' }).format(date);
}
export function agencyDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date) + ' PT'
  );
}
export function agencyBillingCycle(value: string) {
  const setup = /^setup\/(\d+)$/.exec(value);
  if (setup) return `Setup payment ${Number(setup[1]) + 1}`;
  const monthly = /^monthly\/(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(value);
  if (monthly)
    return (
      'Monthly · ' +
      new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(
        new Date(monthly[1] + '-01T00:00:00Z')
      )
    );
  return value;
}
export function agencyChannel(value: string) {
  const names: Record<string, string> = {
    form: 'Form',
    booking: 'Booking',
    referral: 'Referral',
    other: 'Other',
    cold_call: 'Cold call',
    sms: 'SMS',
    email: 'Email',
    dm: 'DM'
  };
  return names[value] ?? value;
}
