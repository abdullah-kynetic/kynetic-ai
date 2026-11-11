// "Apply for your free AI audit" overlay: a one-question-at-a-time application laid out like the
// J&T Solutions one. Every audit button on the page (they link to the Cal booking page) opens it.
// Seven steps, then the booking calendar for every answer. The lowest investment band is not turned away;
// it is only flagged (`lowBudget`) in what is sent to the n8n contact webhook.
// The answers travel as a readable `message` (works with today's workflow) and as structured fields
// (`phone`, `company`, `website`, `answers`, `lowBudget`) for the upgraded workflow.
// Progress is saved in this browser after every OK: closing or leaving and coming back reopens the
// step they were on, with earlier answers filled in, and Back / OK walk through them (like J&T's).
// Without JS the buttons still go to Cal.
import { animate } from 'motion';
import { reducedMotion } from './appear';
import { mountPicker } from './cal-picker';

const ENDPOINT: string = import.meta.env.PUBLIC_CONTACT_WEBHOOK ?? 'https://n8n.kyneticai.com/webhook/website-contact';
const CAL_USER = 'abdullah-kyneticai';
const CAL_SLUG = 'kynetic-ai-discovery-call';
const CAL = `https://cal.com/${CAL_USER}/${CAL_SLUG}`;
const LETTERS = 'ABCDEFGH';
const OTHER = 'Something else';
const LOW_INVEST = 'Under $5,000';

type Step =
  | { n: number; key: string; label: string; kind: 'company'; q: string }
  | { n: number; key: string; label: string; kind: 'text'; q: string; hint: string; placeholder: string }
  | { n: number; key: string; label: string; kind: 'choice'; q: string; options: string[]; other?: boolean };

// Steps 2-7. Step 1 (name, phone, email) is written out below.
const STEPS: Step[] = [
  { n: 2, key: 'company', label: 'Company', kind: 'company', q: 'Tell us about your business.' },
  { n: 3, key: 'niche', label: 'Business type', kind: 'choice', q: 'What kind of business do you run?', other: true,
    options: ['Remodeling', 'Solar and battery', 'Foundation repair', 'Other home service or improvement', OTHER] },
  { n: 4, key: 'revenue', label: 'Annual revenue', kind: 'choice', q: 'Roughly how much does the business make in a year?',
    options: ['Under $500K', '$500K to $2.5M', '$2.5M to $10M', '$10M to $25M', '$25M to $50M', '$50M+'] },
  { n: 5, key: 'teamTime', label: 'Team time', kind: 'text', q: "What takes up most of your team's time?", hint: 'A sentence is plenty', placeholder: 'Scheduling, follow-ups, paperwork...' },
  { n: 6, key: 'fixFirst', label: 'Fix first', kind: 'text', q: 'If we could fix one thing first, what would it be?', hint: 'Rough ideas are fine', placeholder: 'One place to see every lead' },
  { n: 7, key: 'invest', label: 'Investment', kind: 'choice', q: 'If we find the right build, what could you invest in it?',
    options: [DISQUALIFY_INVEST, '$5,000 to $10,000', '$10,000 to $25,000', '$25,000 to $50,000', '$50,000+'] },
];
const COUNT = 7;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pad = (n: number) => String(n).padStart(2, '0');
const BACK = '<button class="am__backlink" type="button" data-back><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3m0 0l4-4M3 8l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Back</button>';

function stepHtml(s: Step) {
  const head = `<h2 class="am__q"><b>${pad(s.n)}</b>${esc(s.q)}</h2>`;
  if (s.kind === 'company') {
    return `<form class="am__step" data-step="${s.n}" hidden novalidate>${head}
      <label>Business name<input name="company" type="text" autocomplete="organization" maxlength="200" placeholder="Acme Remodeling" /></label>
      <label>Website <em>(optional)</em><input name="site" type="text" inputmode="url" autocomplete="url" maxlength="200" placeholder="acmeremodeling.com" /></label>
      <p class="am__err" role="alert" hidden></p>
      <button class="am__btn" type="submit">OK</button>${BACK}</form>`;
  }
  if (s.kind === 'text') {
    return `<form class="am__step" data-step="${s.n}" hidden novalidate>${head}
      <p class="am__hint">${esc(s.hint)}</p>
      <input name="${s.key}" type="text" maxlength="400" placeholder="${esc(s.placeholder)}" aria-label="${esc(s.q)}" />
      <p class="am__err" role="alert" hidden></p>
      <button class="am__btn" type="submit">OK</button>${BACK}</form>`;
  }
  return `<form class="am__step" data-step="${s.n}" data-choice="${s.key}" hidden novalidate>${head}
    <fieldset class="am__opts"><legend class="am__sr">${esc(s.q)}</legend>
      ${s.options.map((o, j) => `<label class="am__opt"><input type="radio" name="${s.key}" value="${esc(o)}" /><span class="am__key">${LETTERS[j]}</span><span class="am__txt">${esc(o)}</span></label>`).join('')}
    </fieldset>
    ${s.other ? '<div class="am__other" hidden><input name="other" type="text" maxlength="120" placeholder="Type your niche" aria-label="Your niche" /><button class="am__btn" type="submit">OK</button></div>' : ''}
    <p class="am__err" role="alert" hidden></p>
    <div class="am__okrow" hidden><button class="am__btn" type="submit">OK</button></div>${BACK}</form>`;
}

export function initAuditModal() {
  const root = document.createElement('div');
  root.className = 'am';
  root.hidden = true;
  root.innerHTML = `
    <div class="am__scrim" data-close></div>
    <div class="am__card" role="dialog" aria-modal="true" aria-labelledby="am-title" tabindex="-1">
      <div class="am__bar">
        <span class="am__pill"><i></i>Kynetic AI application</span>
        <button type="button" class="am__x" data-close aria-label="Close">Close <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      </div>
      <div class="am__body">
        <div class="am__progress" aria-hidden="true"><span></span></div>
        <form class="am__step" data-step="1" novalidate>
          <h2 class="am__q" id="am-title"><b>01</b>Where can we reach you?</h2>
          <label>Name<input name="name" type="text" autocomplete="name" placeholder="Jane" required /></label>
          <label>Phone number<input name="phone" type="tel" autocomplete="tel" placeholder="(201) 555-0123" required /></label>
          <label>Email<input name="email" type="email" autocomplete="email" placeholder="jane@example.com" required /></label>
          <input class="am__trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <p class="am__err" role="alert" hidden></p>
          <button class="am__btn" type="submit">OK</button>
          <p class="am__fine">By clicking OK, you agree to get calls and texts from Kynetic AI at this number, including automated messages, about your audit call and our services. Consent isn't a condition of purchase. Msg &amp; data rates may apply. Msg frequency varies. Reply HELP for help or STOP to opt out.</p>
          <p class="am__fine">By continuing you agree to our <a href="/terms/">Terms &amp; Conditions</a> and <a href="/privacy/">Privacy Policy</a>.</p>
        </form>
        ${STEPS.map(stepHtml).join('')}
        <div class="am__step am__done am__book" data-step="book" hidden>
          <div class="am__bookhead">
            <h2 class="am__q" id="am-book">Pick a time for your AI audit</h2>
            <p>We'll look at what you run today and what it costs you. We'll text you to confirm the call.</p>
          </div>
          <div class="am__picker" id="am-picker"></div>
                    <div class="am__bookback">${BACK}</div>
        </div>
      </div>
    </div>`;
  document.body.append(root);

  const card = root.querySelector<HTMLElement>('.am__card')!;
  const bar = root.querySelector<HTMLElement>('.am__progress span')!;
  const stepEls = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-step]').forEach((s) => stepEls.set(s.dataset.step!, s));
  const form = (n: number) => stepEls.get(String(n)) as HTMLFormElement;
  let opener: HTMLElement | null = null;
  let current = '1';
  let busy = false;
  let timer: number | undefined;

  // ---- saved progress (this browser only) ----
  type Saved = { booked?: string; step: string; v: Record<string, string>; stage?: 'applied'; sent?: string; ts: number };
  const KEY = 'kn-apply-v1';
  const load = (): Saved | null => {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null') as Saved | null;
      return r && Date.now() - r.ts < 30 * 864e5 ? r : null;
    } catch { return null; }
  };
  const persist = (patch: Partial<Saved>) => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...(load() ?? { step: '1', v: {} }), ...patch, ts: Date.now() })); } catch { /* storage blocked: the form still works */ }
  };
  const fields = () => {
    const v: Record<string, string> = {};
    root.querySelectorAll<HTMLInputElement>('form input[name]:not(.am__trap)').forEach((i) => {
      if (i.type === 'radio') { if (i.checked) v[i.name] = i.value; } else v[i.name] = i.value;
    });
    return v;
  };
  const hydrate = (v: Record<string, string>) => {
    root.querySelectorAll<HTMLInputElement>('form input[name]:not(.am__trap)').forEach((i) => {
      if (i.type === 'radio') i.checked = v[i.name] === i.value; else i.value = v[i.name] ?? '';
    });
    root.querySelectorAll<HTMLFormElement>('form[data-choice]').forEach(syncChoice);
  };
  function syncChoice(f: HTMLFormElement) {
    const picked = f.querySelector<HTMLInputElement>('input[type=radio]:checked');
    const other = f.querySelector<HTMLElement>('.am__other');
    const wantsText = !!other && picked?.value === OTHER;
    if (other) other.hidden = !wantsText;
    f.querySelector<HTMLElement>('.am__okrow')!.hidden = !picked || wantsText;
  }

  const err = (f: HTMLElement, msg = '') => {
    const p = f.querySelector<HTMLElement>('.am__err');
    if (!p) return;
    p.textContent = msg;
    p.hidden = !msg;
  };
  const show = (id: string | number) => {
    current = String(id);
    stepEls.forEach((s, k) => (s.hidden = k !== current));
    const n = Number(current);
    card.classList.toggle('am--end', Number.isNaN(n));
    bar.style.width = Number.isNaN(n) ? '100%' : `${Math.round(((n - 1) / COUNT) * 100)}%`;
    const next = stepEls.get(current)!;
    const focusEl = next.querySelector<HTMLElement>('input[type=text]:not(.am__trap), input[type=tel], input[type=radio]:checked, .am__opt input');
    (focusEl ?? card).focus({ preventScroll: true });
    card.scrollTop = 0;
    if (!reducedMotion()) animate(next, { opacity: [0, 1], y: [14, 0] }, { type: 'spring', stiffness: 260, damping: 28 });
  };
  // Where to resume: the saved step, or the calendar once the application was sent.
  const resume = () => {
    const s = load();
    if (!s) { show(1); return; }
    hydrate(s.v);
    if (s.booked && s.stage === 'applied') { location.assign(`/confirmation/?t=${encodeURIComponent(s.booked)}`); return; }
    if (s.stage === 'applied') { showBook(); return; }
    show(STEPS.some((x) => String(x.n) === s.step) || s.step === '1' ? s.step : 1);
  };
  const open = (from?: HTMLElement | null) => {
    opener = from ?? (document.activeElement as HTMLElement | null);
    root.hidden = false;
    document.documentElement.classList.add('am-lock');
    ensurePicker();
    resume();
    if (!reducedMotion()) {
      animate(root.querySelector('.am__scrim')!, { opacity: [0, 1] }, { duration: 0.2 });
      animate(card, { opacity: [0, 1], y: [24, 0], scale: [0.97, 1] }, { type: 'spring', stiffness: 300, damping: 28 });
    }
  };
  const close = () => {
    root.hidden = true;
    document.documentElement.classList.remove('am-lock');
    opener?.focus?.();
  };
  // Move on after a valid OK: remember the answers and the next step.
  const advance = (to: number) => { persist({ v: fields(), step: String(to) }); show(to); };

  const calUrl = () => {
    const v = load()?.v ?? fields();
    const u = new URL(CAL);
    if (v.name) u.searchParams.set('name', v.name);
    if (v.email) u.searchParams.set('email', v.email);
    return u.toString();
  };
  const e164 = (p = '') => { const d = p.replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d.length > 10 ? `+${d}` : ''; };
  let mounted = false;
  function showBook() { ensurePicker(); show('book'); }
  // Mounted (and its open times fetched) as soon as the overlay opens, so the calendar is ready by the last step.
  function ensurePicker() {
    if (mounted) return;
    mounted = true;
    mountPicker(root.querySelector<HTMLElement>('#am-picker')!, {
      username: CAL_USER, slug: CAL_SLUG, fallbackUrl: calUrl,
      attendee: () => {
        const v = load()?.v ?? fields();
        const notes = [v.company && `Company: ${v.company}${v.site ? ` (${v.site})` : ''}`, v.niche && `Business type: ${v.niche === OTHER ? `Other: ${v.other ?? ''}` : v.niche}`, v.revenue && `Revenue: ${v.revenue}`, v.teamTime && `Takes team's time: ${v.teamTime}`, v.fixFirst && `Fix first: ${v.fixFirst}`, v.invest && `Could invest: ${v.invest}`].filter(Boolean).join('\n');
        return { name: v.name ?? '', email: v.email ?? '', phone: e164(v.phone), notes };
      },
      onBooked: (start) => { persist({ booked: start }); location.assign(`/confirmation/?t=${encodeURIComponent(start)}`); },
    });
  }

  root.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') {
      // Press a letter to choose that option (not while typing in a field).
      const t = e.target as HTMLElement;
      const f = t.closest<HTMLFormElement>('form[data-choice]');
      if (f && (t.tagName !== 'INPUT' || (t as HTMLInputElement).type === 'radio')) {
        if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
          const idx = LETTERS.indexOf(e.key.toUpperCase());
          const radios = f.querySelectorAll<HTMLInputElement>('input[type=radio]');
          if (idx >= 0 && radios[idx]) { radios[idx].checked = true; radios[idx].dispatchEvent(new Event('change', { bubbles: true })); }
        }
      }
      return;
    }
    const f = [...card.querySelectorAll<HTMLElement>('button, a[href], input:not(.am__trap), textarea, select')].filter((el) => !el.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Back keeps what was typed and saves where they are, so reopening lands on the same screen.
  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
    clearTimeout(timer);
    err(b.closest('form') ?? card);
    const to = current === 'book' ? COUNT : Math.max(1, Number(current) - 1);
    persist({ v: { ...(load()?.v ?? {}), ...fields() }, step: String(to), stage: undefined });
    show(to);
  }));

  // Every audit button (the Cal link) and any [data-audit-open] opens the dialog.
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('a[href*="cal.com/abdullah-kyneticai"], [data-audit-open]');
    if (!a || a.closest('.am')) return;
    e.preventDefault();
    open(a);
  });
  if (location.hash === '#audit') open();
  window.addEventListener('hashchange', () => { if (location.hash === '#audit') open(); });
  document.querySelector('.kn-skip')?.addEventListener('click', (e) => { e.preventDefault(); open(e.currentTarget as HTMLElement); });

  const val = (f: HTMLFormElement, n: string) => (f.elements.namedItem(n) as HTMLInputElement).value.trim();
  const focus = (f: HTMLFormElement, n: string) => (f.elements.namedItem(n) as HTMLElement).focus();

  form(1).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form(1);
    if (!val(f, 'name')) { err(f, 'Please enter your name.'); focus(f, 'name'); return; }
    if ((val(f, 'phone').match(/\d/g) ?? []).length < 7) { err(f, 'Please enter a phone number.'); focus(f, 'phone'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val(f, 'email'))) { err(f, 'Please enter a valid email address.'); focus(f, 'email'); return; }
    err(f); advance(2);
  });

  const queueSubmit = (f: HTMLFormElement) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (current === f.dataset.step) f.requestSubmit(); }, 250);
  };
  for (const s of STEPS) {
    const f = form(s.n);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(timer);
      if (s.kind === 'company') {
        if (val(f, 'company').length < 2) { err(f, 'Please enter your business name.'); focus(f, 'company'); return; }
      } else if (s.kind === 'text') {
        if (val(f, s.key).length < 2) { err(f, 'Please answer to continue.'); focus(f, s.key); return; }
      } else {
        const picked = f.querySelector<HTMLInputElement>('input[type=radio]:checked');
        if (!picked) { err(f, 'Please pick one.'); return; }
        if (s.other && picked.value === OTHER && !val(f, 'other')) { err(f, 'Please type your niche.'); focus(f, 'other'); return; }
      }
      err(f);
      if (s.n < COUNT) advance(s.n + 1); else void submit();
    });
    if (s.kind === 'choice') {
      f.addEventListener('change', () => {
        syncChoice(f);
        if (!f.querySelector('.am__other:not([hidden])')) queueSubmit(f);
        else f.querySelector<HTMLInputElement>('input[name=other]')!.focus();
      });
      // choosing the option that is already selected (after Back) also moves on
      f.addEventListener('click', (e) => {
        const o = (e.target as HTMLElement).closest('.am__opt');
        const r = o?.querySelector<HTMLInputElement>('input');
        if (r?.checked && r.value !== OTHER) queueSubmit(f);
      });
    }
  }

  const text = (key: string) => {
    const s = STEPS.find((x) => x.key === key)!;
    const f = form(s.n);
    if (s.kind !== 'choice') return val(f, key);
    const v = f.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value ?? '';
    return v === OTHER ? `Other: ${val(f, 'other')}` : v;
  };

  async function submit() {
    if (busy) return;
    const f1 = form(1), last = form(COUNT);
    if (val(f1, 'website')) { showBook(); return; } // bot: pretend it worked, send nothing
    const name = val(f1, 'name'), phone = val(f1, 'phone'), email = val(f1, 'email');
    const company = text('company'), site = val(form(2), 'site');
    const answers = Object.fromEntries(STEPS.filter((s) => s.kind !== 'company').map((s) => [s.key, text(s.key)]));
    const lowBudget = answers.invest === LOW_INVEST;
    const message = [
      `AI audit application${lowBudget ? ' (LOW BUDGET: under $5,000)' : ''}`,
      `Phone: ${phone} (agreed to calls and texts about the audit)`,
      `Business: ${company}${site ? ` (${site})` : ''}`,
      ...STEPS.filter((s) => s.kind !== 'company').map((s) => `${s.label}: ${answers[s.key]}`),
      `Page: ${location.href}`,
    ].join('\n');
    const prior = load();
    const fingerprint = JSON.stringify([name, phone, email, company, site, answers]);
    const finish = () => {
      persist({ v: fields(), stage: 'applied', sent: fingerprint, step: String(COUNT) });
      showBook();
    };
    // Same answers already sent from this browser (they went Back and forward again): don't send twice.
    if (prior?.sent === fingerprint) { finish(); return; }
    const btn = last.querySelector<HTMLButtonElement>('.am__okrow button');
    busy = true; if (btn) btn.disabled = true; err(last);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, page: location.href, source: 'audit-application', phone, company, website: site, answers, lowBudget, updated: !!prior?.sent }),
      });
      if (!res.ok) throw new Error(String(res.status));
      finish();
    } catch (error) {
      console.error('audit application:', error);
      err(last, 'Something went wrong sending that. Please try again, or email abdullah@kyneticai.com.');
    } finally {
      busy = false; if (btn) btn.disabled = false;
    }
  }
}
