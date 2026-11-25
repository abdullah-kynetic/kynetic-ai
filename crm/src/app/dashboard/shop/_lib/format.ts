/** Whole dollars from cents, for shop screens: $1,234. */
export const money = (cents: number): string =>
  `$${Math.round(cents / 100).toLocaleString('en-US')}`;

/** Date and time in the shop's own time zone, for example "Wed, Nov 25, 2:00 PM". */
export const when = (iso: string, timeZone = 'America/Chicago'): string =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone
  });

export const day = (iso: string, timeZone = 'America/Chicago'): string =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone
  });
