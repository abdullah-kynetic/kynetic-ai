const w = $('Calendar Window').first().json;
const res = $input.first().json;
const data = (res && res.status === 'success' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)) ? res.data : null;
if (!data) {
  return [{ json: { match: 'error', requested_date: w.pref || null, slots: [], note: 'The calendar lookup failed. Do not offer any times. Offer a callback instead.' } }];
}
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const MINS = { 0: '', 15: 'fifteen', 30: 'thirty', 45: 'forty five' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function spoken(s, far) {
  const date = s.slice(0, 10);
  const h = parseInt(s.slice(11, 13), 10);
  const m = parseInt(s.slice(14, 16), 10);
  const d = new Date(date + 'T12:00:00Z');
  const hour12 = h % 12 || 12;
  const mm = (m in MINS) ? MINS[m] : String(m);
  const t = ONES[hour12] + (mm ? ' ' + mm : '') + (h >= 12 ? ' PM' : ' AM');
  const day = DAYS[d.getUTCDay()] + (far ? ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() : '');
  return day + ' at ' + t;
}
function evenly(list, n) {
  if (list.length <= n) return list;
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round(i * (list.length - 1) / (n - 1))]);
  return out;
}
const days = Object.keys(data).sort().filter(d => Array.isArray(data[d]) && data[d].length);
const first = days.length ? new Date(days[0] + 'T12:00:00Z').getTime() : 0;
const far = (d) => (new Date(d + 'T12:00:00Z').getTime() - new Date(w.start + 'T12:00:00Z').getTime()) > 6 * 86400000;
const hourOf = (x) => parseInt(x.start.slice(11, 13), 10);
let match = 'earliest', picked = [], note = '';
if (!days.length) {
  return [{ json: { match: 'none', requested_date: w.pref || null, slots: [], note: 'No open times in the next two weeks. Offer a callback instead.' } }];
}
if (w.pref && data[w.pref] && data[w.pref].length) {
  let list = data[w.pref];
  if (w.tod === 'morning') { const f = list.filter(x => hourOf(x) < 12); if (f.length) list = f; }
  if (w.tod === 'afternoon') { const f = list.filter(x => hourOf(x) >= 12); if (f.length) list = f; }
  picked = evenly(list, 4).map(x => ({ start: x.start, spoken: spoken(x.start, false) }));
  match = 'exact';
  note = 'These are open on the day the lead asked for. Offer two of them.';
} else if (w.pref) {
  const target = new Date(w.pref + 'T12:00:00Z').getTime();
  const near = days.slice().sort((a, b) => Math.abs(new Date(a + 'T12:00:00Z') - target) - Math.abs(new Date(b + 'T12:00:00Z') - target)).slice(0, 3).sort();
  near.forEach(d => { evenly(data[d], 2).forEach(x => picked.push({ start: x.start, spoken: spoken(x.start, far(d)) })); });
  match = 'nearest';
  note = 'The day the lead asked for has no openings. Say so, then offer two of these nearest times.';
} else {
  days.slice(0, 2).forEach(d => { evenly(data[d], 2).forEach(x => picked.push({ start: x.start, spoken: spoken(x.start, far(d)) })); });
  match = 'earliest';
  note = 'These are the earliest openings. Offer the first two.';
}
return [{ json: { match, requested_date: w.pref || null, slots: picked, note } }];
