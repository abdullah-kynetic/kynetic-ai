// Wall-clock <-> instant conversion in a named IANA zone (F-20). A task's due time is typed in the
// tenant's local time, so "today" and "overdue" follow the business, not the server or the browser.

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parts(ms: number, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(ms));
  const n = (t: string) => Number(f.find((p) => p.type === t)?.value);
  return {
    y: n('year'),
    mo: n('month'),
    d: n('day'),
    h: n('hour'),
    mi: n('minute'),
    s: n('second')
  };
}

/** Offset of `timeZone` from UTC at an instant, in ms (positive east of UTC). */
function offsetAt(ms: number, timeZone: string): number {
  const p = parts(ms, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** `2026-10-27T09:30` typed in `timeZone` to the instant it names. Returns null if malformed. */
export function localToInstant(local: string, timeZone: string): Date | null {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset across a daylight-saving boundary.
  let ms = wall - offsetAt(wall, timeZone);
  ms = wall - offsetAt(ms, timeZone);
  const out = new Date(ms);
  return Number.isNaN(out.getTime()) ? null : out;
}

const z = (v: number, w = 2) => String(v).padStart(w, '0');

/** An instant as `YYYY-MM-DDTHH:mm` in `timeZone`, the value a datetime-local input takes. */
export function instantToLocal(iso: string, timeZone: string): string {
  const p = parts(new Date(iso).getTime(), timeZone);
  return `${z(p.y, 4)}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}
