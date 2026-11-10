/** Wall-clock conversion for the agency workspace. Pacific time, including daylight saving. */
export const PACIFIC_TIME_ZONE = 'America/Los_Angeles';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export function pacificOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);
  const map = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  const wallAsUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((wallAsUtc - instant.getTime()) / 60_000);
}

/** Interpret a Pacific date and time as a UTC instant. Invalid calendar values throw. */
export function pacificDateTimeToUtc(date: string, time: string): string {
  if (!DATE.test(date) || !TIME.test(time)) throw new Error('invalid_pacific_datetime');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59)
    throw new Error('invalid_pacific_datetime');
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = pacificOffsetMinutes(new Date(utcGuess));
  let instant = new Date(utcGuess - first * 60_000);
  const second = pacificOffsetMinutes(instant);
  if (second !== first) instant = new Date(utcGuess - second * 60_000);
  const check = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(instant);
  const expected = `${date}, ${time}`;
  if (check !== expected) throw new Error('invalid_pacific_datetime');
  return instant.toISOString();
}

/** YYYY-MM for an instant in Pacific time. Date-only values stay on that calendar month. */
export function pacificMonth(value: string): string {
  if (DATE.test(value)) return value.slice(0, 7);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit'
  }).format(new Date(value));
  return parts.slice(0, 7);
}

export function currentPacificMonth(now = new Date()): string {
  return pacificMonth(now.toISOString());
}
