// Day-and-time picker for the audit overlay's last step. Reads the open times from Cal.com's public
// slots API and books the call straight from the application's answers, so the visitor only picks a day
// and a time (no second form). Falls back to the full Cal page if the API can't be reached.
const API = 'https://api.cal.com/v2';

export type Attendee = { name: string; email: string; phone?: string; notes?: string };
type Opts = {
  username: string;
  slug: string;
  fallbackUrl: () => string;
  attendee: () => Attendee;
  onBooked: (startIso: string, tz: string) => void;
};

const ZONES: [string, string][] = [
  ['America/New_York', 'Eastern Time - US & Canada'],
  ['America/Chicago', 'Central Time - US & Canada'],
  ['America/Denver', 'Mountain Time - US & Canada'],
  ['America/Phoenix', 'Arizona'],
  ['America/Los_Angeles', 'Pacific Time - US & Canada'],
  ['America/Anchorage', 'Alaska'],
  ['Pacific/Honolulu', 'Hawaii'],
];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function mountPicker(host: HTMLElement, o: Opts) {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  const zones = ZONES.some(([z]) => z === browserTz) ? ZONES : ([[browserTz, browserTz.replace(/_/g, ' ')], ...ZONES] as [string, string][]);
  let tz = browserTz;
  let view = new Date(); view.setDate(1); view.setHours(0, 0, 0, 0);
  let slots: Record<string, { start: string }[]> = {};
  let day = '';
  let chosen = '';
  let busy = false;
  const cache = new Map<string, Record<string, { start: string }[]>>();

  host.innerHTML = `
    <div class="cp">
      <h3 class="cp__title" id="cp-title">Select a Day</h3>
      <div class="cp__nav"><button type="button" class="cp__arrow" data-prev aria-label="Previous month"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 3L5 9l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><b class="cp__month" aria-live="polite"></b><button type="button" class="cp__arrow" data-next aria-label="Next month"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 3l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <div class="cp__grid" role="grid" aria-labelledby="cp-title"></div>
      <label class="cp__tz">Time zone<select>${zones.map(([z, n]) => `<option value="${esc(z)}"${z === tz ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="cp__times" hidden><h3 class="cp__day"></h3><div class="cp__list"></div></div>
      <p class="cp__msg" role="status" hidden></p>
    </div>`;
  const $ = <T extends HTMLElement>(s: string) => host.querySelector<T>(s)!;
  const monthEl = $('.cp__month'), grid = $('.cp__grid'), timesEl = $('.cp__times'), listEl = $('.cp__list'), dayEl = $('.cp__day'), msg = $('.cp__msg');
  const prev = $<HTMLButtonElement>('[data-prev]'), next = $<HTMLButtonElement>('[data-next]');

  const say = (text = '', link = false) => {
    msg.hidden = !text;
    msg.innerHTML = esc(text) + (link ? ` <a href="${esc(o.fallbackUrl())}" target="_blank" rel="noopener">Open the calendar in a new tab</a>` : '');
  };

  async function load() {
    const key = `${ymd(view)}|${tz}`;
    say(); grid.setAttribute('aria-busy', 'true');
    if (!cache.has(key)) {
      const first = new Date(Math.max(view.getTime(), Date.now() - 864e5));
      const last = new Date(view.getFullYear(), view.getMonth() + 1, 0);
      try {
        const q = new URLSearchParams({ eventTypeSlug: o.slug, username: o.username, start: ymd(first), end: ymd(last), timeZone: tz });
        const res = await fetch(`${API}/slots?${q}`, { headers: { 'cal-api-version': '2024-09-04' } });
        const j = await res.json();
        if (!res.ok || j.status !== 'success') throw new Error('slots');
        cache.set(key, j.data as Record<string, { start: string }[]>);
      } catch {
        slots = {}; render(); say("We couldn't load the calendar.", true); grid.removeAttribute('aria-busy'); return;
      }
    }
    slots = cache.get(key)!;
    grid.removeAttribute('aria-busy');
    render();
  }

  function render() {
    monthEl.textContent = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const now = new Date(); const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    prev.disabled = view <= thisMonth;
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const lead = view.getDay();
    let h = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<span class="cp__dow">${d}</span>`).join('');
    for (let i = 0; i < lead; i++) h += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const k = `${view.getFullYear()}-${pad(view.getMonth() + 1)}-${pad(d)}`;
      const on = !!slots[k]?.length;
      h += `<button type="button" class="cp__day-btn${on ? ' is-open' : ''}${k === day ? ' is-picked' : ''}" data-day="${k}" ${on ? '' : 'disabled'} aria-label="${new Date(`${k}T12:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${on ? '' : ', unavailable'}">${d}</button>`;
    }
    grid.innerHTML = h;
    if (day && !slots[day]) { day = ''; chosen = ''; }
    renderTimes();
  }

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).replace(' AM', ' am').replace(' PM', ' pm');
  function renderTimes() {
    timesEl.hidden = !day;
    if (!day) return;
    dayEl.textContent = new Date(`${day}T12:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    listEl.innerHTML = (slots[day] ?? []).map((s) => s.start === chosen
      ? `<div class="cp__pair"><span class="cp__time is-chosen">${fmt(s.start)}</span><button type="button" class="cp__confirm" data-confirm>Confirm</button></div>`
      : `<button type="button" class="cp__time" data-time="${esc(s.start)}">${fmt(s.start)}</button>`).join('');
  }

  async function book() {
    if (busy || !chosen) return;
    busy = true; say();
    const btn = host.querySelector<HTMLButtonElement>('[data-confirm]'); if (btn) { btn.disabled = true; btn.textContent = 'Booking…'; }
    const a = o.attendee();
    try {
      const res = await fetch(`${API}/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'cal-api-version': '2024-08-13' },
        body: JSON.stringify({
          start: new Date(chosen).toISOString(), username: o.username, eventTypeSlug: o.slug,
          attendee: { name: a.name, email: a.email, timeZone: tz, ...(a.phone ? { phoneNumber: a.phone } : {}) },
          ...(a.notes ? { bookingFieldsResponses: { notes: a.notes } } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== 'success') {
        // someone else took the time, or the booking was refused: refresh the open times
        cache.clear(); chosen = '';
        await load();
        say(res.status === 400 || res.status === 409 ? 'That time was just taken. Please pick another.' : "We couldn't book that. Please try again.", res.status !== 400 && res.status !== 409);
        return;
      }
      o.onBooked(chosen, tz);
    } catch {
      chosen = ''; renderTimes();
      say("We couldn't reach the calendar.", true);
    } finally { busy = false; }
  }

  host.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const d = t.closest<HTMLElement>('[data-day]'); if (d && !(d as HTMLButtonElement).disabled) { day = d.dataset.day!; chosen = ''; render(); host.querySelector<HTMLElement>('.cp__time')?.focus({ preventScroll: true }); timesEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const s = t.closest<HTMLElement>('[data-time]'); if (s) { chosen = s.dataset.time!; renderTimes(); host.querySelector<HTMLElement>('[data-confirm]')?.focus({ preventScroll: true }); return; }
    if (t.closest('[data-confirm]')) { void book(); return; }
    if (t.closest('[data-prev]')) { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); day = ''; chosen = ''; void load(); return; }
    if (t.closest('[data-next]')) { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); day = ''; chosen = ''; void load(); }
  });
  host.querySelector('select')!.addEventListener('change', (e) => { tz = (e.target as HTMLSelectElement).value; day = ''; chosen = ''; void load(); });

  void load();
}
