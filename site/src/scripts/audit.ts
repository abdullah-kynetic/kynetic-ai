// Audit calculator. Pure client-side: reads the form, renders results. No storage, no network.
const form = document.getElementById('au-form') as HTMLFormElement;
const $ = (id: string) => document.getElementById(id)!;
const num = (n: string) => { const v = parseFloat((form.elements.namedItem(n) as HTMLInputElement)?.value); return isFinite(v) ? v : 0; };
const str = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement)?.value || '').trim();
const pct = (n: string) => num(n) / 100;
const usd = (v: number) => '$' + Math.round(v).toLocaleString('en-US');
const r1 = (v: number) => (Math.round(v * 10) / 10).toString();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function fit() {
  const red: string[] = [], yellow: string[] = [], green: string[] = [];
  const meta = str('metaAds'), spend = num('spend'), job = num('job'), cap = str('capacity'), dm = str('dm');
  if (meta === 'no') red.push('Not running Meta ads.'); else if (meta === 'yes') green.push('Running Meta ads.');
  if (str('spend')) { if (spend < 2000) red.push(`Meta spend ${usd(spend)}/mo is under $2K.`); else green.push(`Meta spend ${usd(spend)}/mo.`); }
  if (str('job')) { if (job < 10000) yellow.push(`Avg job ${usd(job)} is under $10K (weak fit).`); else green.push(`Avg job ${usd(job)}.`); }
  if (cap === 'no') red.push('Booked solid, no capacity for more work.'); else if (cap === 'some') yellow.push('Only some room for more work.'); else if (cap === 'yes') green.push('Has capacity.');
  if (dm === 'no') yellow.push('Decision-maker not on the call. Book a follow-up with them.'); else if (dm === 'yes') green.push('Decision-maker present.');
  if (str('leads') && num('leads') < 20) yellow.push(`Only ${num('leads')} leads/mo; small volume to work.`);
  if (str('niche') === 'other') yellow.push('Niche outside our 5 core trades.');
  const level = red.length ? 'red' : yellow.length ? 'yellow' : green.length ? 'green' : '';
  const el = $('au-fit');
  el.className = 'au-verdict ' + level;
  const head = { red: 'Not a fit', yellow: 'Possible fit, with caveats', green: 'Good fit', '': '' }[level];
  el.innerHTML = level ? `<strong>${head}</strong><ul>${[...red, ...yellow, ...green].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  return level;
}

function calc() {
  const level = fit();
  const leads = num('leads'), job = num('job'), margin = pct('margin'), close = pct('close'), book = pct('book');
  const contact = pct('contact'), target = pct('aTarget'), feePct = pct('aPct'), setupX = num('aSetupX'), floor = num('aFloor'), min = num('aMin');
  const unit = job * margin; // profit per closed job
  const coreJobs = leads * Math.max(0, target - book) * close;
  const sol = [
    { key: 'core', name: 'Alex speed-to-lead (core)', why: 'Calls every Meta lead in ~60s, qualifies, books.', jobs: coreJobs, value: coreJobs * unit, once: false },
    { key: 'react', name: 'Old-lead reactivation', why: `${num('oldLeads')} old leads × ${num('aReact')}% re-engage.`, jobs: num('oldLeads') * pct('aReact') * close, value: num('oldLeads') * pct('aReact') * close * unit, once: true },
    { key: 'quote', name: 'Quote follow-up', why: `${num('quotes')} open quotes × ${num('aQuote')}% recovered.`, jobs: num('quotes') * pct('aQuote'), value: num('quotes') * pct('aQuote') * unit, once: true },
    { key: 'missed', name: 'After-hours / missed calls', why: `${num('missed')} missed calls/mo × ${num('aMissedBook')}% book × ${num('close')}% close.`, jobs: num('missed') * pct('aMissedBook') * close, value: num('missed') * pct('aMissedBook') * close * unit, once: false },
  ];
  const ah = str('afterHours');
  const rows = sol.map((s) => {
    let rec = s.key === 'core' ? level !== 'red' && s.value > 0 : s.value >= min;
    if (s.key === 'missed' && ah === 'covered' && s.value < min * 2) rec = false;
    const monthly = s.once ? 0 : s.value * feePct;
    const setup = s.once ? s.value * feePct : s.value * setupX;
    return { ...s, rec, monthly, setup };
  });
  const crmNeed = str('crm') === 'no' || str('crm') === 'partial';
  rows.push({ key: 'crm', name: 'Full CRM build-out', why: crmNeed ? 'No real pipeline today; everything else runs on it.' : 'Already has a working CRM.', jobs: 0, value: 0, once: false, rec: crmNeed, monthly: num('aCrmMo'), setup: num('aCrmSetup') });

  const picked = rows.filter((r) => r.rec);
  const monthlyValue = picked.filter((r) => !r.once).reduce((a, r) => a + r.value, 0);
  const totMonthly = picked.reduce((a, r) => a + r.monthly, 0);
  const totSetup = Math.max(floor, picked.reduce((a, r) => a + r.setup, 0));
  const lo = monthlyValue * 0.10 + (crmNeed ? num('aCrmMo') : 0), hi = monthlyValue * 0.20 + (crmNeed ? num('aCrmMo') : 0);

  $('au-kpis').innerHTML = [
    ['Recovered jobs / mo (core)', r1(coreJobs)],
    ['Recovered profit / mo (core)', usd(coreJobs * unit)],
    ['Profit / mo, recommended', usd(monthlyValue)],
    ['One-time profit (old leads + open quotes)', usd(rows[1].value + rows[2].value)],
  ].map(([k, v]) => `<div class="au-kpi">${k}<b>${v}</b></div>`).join('');

  const reached = Math.round(leads * contact), booked = Math.round(leads * book), closed = Math.round(leads * book * close);
  const biz = str('biz') || 'you';
  $('au-talk').textContent = `"You're getting ${leads} leads a month, reaching about ${reached}, booking ${booked} and closing about ${closed}. ` +
    `Getting your booking rate from ${num('book')}% to ${num('aTarget')}% alone is about ${r1(coreJobs)} more jobs, so ${biz === 'you' ? "you're" : biz + ' is'} losing about ${usd(monthlyValue)} a month in profit right now. ` +
    `We'd fix that for ${usd(totMonthly)} a month, about ${Math.round(feePct * 100)}% of what it recovers, and if you're not live with booked appointments in 14 days, that month is free."`;

  $('au-solutions').innerHTML = `<tr><th>Solution</th><th class="n">Jobs</th><th class="n">Profit</th><th class="n">Setup / one-time</th><th class="n">Monthly</th></tr>` +
    rows.map((r) => `<tr class="${r.rec ? '' : 'skip'}"><td><strong>${r.name}</strong><span class="tag ${r.rec ? 'yes' : 'no'}">${r.rec ? 'Recommend' : 'Skip'}</span><br>${esc(r.why)}</td>` +
      `<td class="n">${r.key === 'crm' ? '—' : r1(r.jobs) + (r.once ? ' once' : '/mo')}</td><td class="n">${r.key === 'crm' ? '—' : usd(r.value) + (r.once ? ' once' : '/mo')}</td>` +
      `<td class="n">${usd(r.setup)}</td><td class="n">${r.once ? '—' : usd(r.monthly)}</td></tr>`).join('') +
    `<tr class="total"><td>Total (recommended)</td><td></td><td class="n">${usd(monthlyValue)}/mo</td><td class="n">${usd(totSetup)}</td><td class="n">${usd(totMonthly)}</td></tr>`;

  $('au-price').innerHTML = level === 'red'
    ? `<strong>Not a fit on the numbers above.</strong> Don't quote; leave the door open.`
    : `Suggested price: <b>${usd(totSetup)} setup</b> (${setupX}× one month of recovered profit, floor ${usd(floor)}; 50% at signing, 25% at go-live, 25% on day 45) + <b>${usd(totMonthly)}/mo</b> (${Math.round(feePct * 100)}% of recovered profit; 10–20% range: ${usd(lo)}–${usd(hi)}/mo).`;
  return { rows, totSetup, totMonthly, monthlyValue, level };
}

function summary() {
  const { rows, totSetup, totMonthly, monthlyValue, level } = calc();
  const L = [`Kynetic AI audit: ${str('biz') || '(no name)'} (${str('niche')})`, `Fit: ${level || 'n/a'}`,
    `Meta spend ${usd(num('spend'))}/mo · ${num('leads')} leads/mo · avg job ${usd(num('job'))} · margin ${num('margin')}%`,
    `Contact ${num('contact')}% · booking ${num('book')}% · close ${num('close')}% · speed ${str('speed') || '?'} min · attempts ${num('attempts')}`,
    '', 'Solutions:', ...rows.map((r) => `- ${r.rec ? '[x]' : '[ ]'} ${r.name}: ${usd(r.value)}${r.once ? ' once' : '/mo'} value · setup ${usd(r.setup)} · ${usd(r.monthly)}/mo`),
    '', `Recovered profit: ${usd(monthlyValue)}/mo`, `Price: ${usd(totSetup)} setup + ${usd(totMonthly)}/mo`, '', 'Talk track:', $('au-talk').textContent || '',
    '', 'Pain notes:', `- 2 more jobs: ${str('pain2jobs')}`, `- Cost of bad follow-up: ${str('painCost')}`, `- Tried before: ${str('painTried')}`,
    '', 'Guarantee: live in 14 days with booked appointments, or that month\'s fee is waived.'];
  return L.join('\n');
}

function go(step: string) {
  document.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== step));
  document.querySelectorAll<HTMLElement>('.au-steps [data-step]').forEach((b) => b.classList.toggle('on', b.dataset.step === step));
  calc(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll<HTMLElement>('[data-step],[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.step || b.dataset.go!)));
form.addEventListener('input', calc);
form.addEventListener('change', calc);

const EXAMPLE: Record<string, string> = { biz: 'Example Remodeling Co.', niche: 'remodeling', metaAds: 'yes', spend: '4000', leads: '80', job: '27000', capacity: 'yes', dm: 'yes', crm: 'partial',
  speed: '240', afterHours: 'vm', who: 'Owner, between jobs', contact: '45', book: '15', close: '20', attempts: '2', margin: '35', oldLeads: '600', quotes: '25', missed: '10',
  pain2jobs: 'Could hire a second crew.', painCost: 'Probably 10+ jobs that went to whoever called first.', painTried: 'A VA for 3 months; leads still sat overnight.' };
$('au-example').addEventListener('click', () => { for (const [k, v] of Object.entries(EXAMPLE)) (form.elements.namedItem(k) as HTMLInputElement).value = v; $('au-example-flag').hidden = false; calc(); });
$('au-reset').addEventListener('click', () => { form.reset(); $('au-example-flag').hidden = true; calc(); });
$('au-print').addEventListener('click', () => { calc(); document.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = false)); window.print(); go('4'); });
$('au-copy').addEventListener('click', async () => { await navigator.clipboard.writeText(summary()); const c = $('au-copied'); c.hidden = false; setTimeout(() => (c.hidden = true), 2000); });
calc();
