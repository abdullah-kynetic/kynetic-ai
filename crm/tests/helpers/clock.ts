/** Deterministic clock for time-dependent code (quiet hours, call windows, due scans). */
export function fakeClock(start: string | Date) {
  let now = new Date(start);
  return {
    now: () => new Date(now),
    set: (d: string | Date) => {
      now = new Date(d);
    },
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    }
  };
}
