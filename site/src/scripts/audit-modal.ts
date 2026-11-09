// "Apply for your free AI audit" overlay: a one-question-at-a-time application, modelled on the
// J&T Solutions flow. Every audit button on the page (they link to the Cal booking page) opens it.
// Seven questions, then one of two endings: a booking page (qualified) or a "not the right fit yet"
// page (lowest investment answer). Every application is sent to the n8n contact webhook, qualified or
// not, so nothing is lost. The answers travel both as a readable `message` (works with today's workflow)
// and as structured fields (`phone`, `company`, `website`, `answers`, `qualified`) for the upgraded one.
// Without JS the buttons still go to Cal.
import { animate } from 'motion';
import { reducedMotion } from './appear';

const ENDPOINT: string = import.meta.env.PUBLIC_CONTACT_WEBHOOK ?? 'https://n8n.kyneticai.com/webhook/website-contact';
const CAL = 'https://cal.com/abdullah-kyneticai/kynetic-ai-discovery-call';
const LETTERS = 'ABCDEFGH';

type Choice = { key: string; q: string; hint: string; options: string[]; label: string };
const CHOICES: Choice[] = [
  { key: 'type', label: 'Business type', q: 'What kind of business do you run?', hint: 'Pick the closest fit.',
    options: ['Home services or remodeling', 'Roofing, solar or exteriors', 'Professional services', 'Health, wellness or beauty', 'Retail or e-commerce', 'Something else'] },
  { key: 'revenue', label: 'Annual revenue', q: 'What does the business make in a year?', hint: 'A rough range is fine. It helps us size what to build.',
    options: ['Under $250k', '$250k to $1M', '$1M to $3M', '$3M to $10M', 'Over $10M'] },
  { key: 'fix', label: 'Fix first', q: 'What would you fix first if you could?', hint: 'The audit starts here.',
    options: ['Leads slip away before we follow up', 'Too much time on admin and back-office work', 'Few reviews and a weak online presence', 'No clear picture of what is working', 'Everything. I want the whole business rebuilt'] },
  { key: 'invest', label: 'Investment', q: 'How much are you ready to invest in AI for the business?', hint: 'No wrong answer. It tells us what is realistic to build.',
    options: ['Under $5,000', '$5,000 to $10,000', '$10,000 to $25,000', '$25,000 or more'] },
];
const DISQUALIFY_INVEST = 'Under $5,000';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pad = (n: number) => String(n).padStart(2, '0');

export function initAuditModal() {
  // Question list: 1 name+email, 2 phone, 3 business+website, 4..7 the four choices. Seven in all.
  const COUNT = 3 + CHOICES.length;
  const choiceSteps = CHOICES.map((c, i) => {
    const n = 4 + i;
    return `<form class="am__step" data-step="${n}" data-choice="${c.key}" hidden novalidate>
      <h2 class="am__q"><b>${pad(n)}</b>${esc(c.q)}</h2>
      <p class="am__hint">${esc(c.hint)}</p>
      <fieldset class="am__opts"><legend class="am__sr">${esc(c.q)}</legend>
        ${c.options.map((o, j) => `<label class="am__opt"><input type="radio" name="${c.key}" value="${esc(o)}" /><span class="am__key">${LETTERS[j]}</span><span class="am__txt">${esc(o)}</span></label>`).join('')}
      </fieldset>
      <p class="am__err" role="alert" hidden></p>
      <div class="am__row"><button class="am__back" type="button" data-back>Back</button>${n === COUNT ? '<button class="am__btn" type="submit">Submit my application</button>' : '<button class="am__btn" type="submit">OK</button>'}</div>
    </form>`;
  }).join('');

  const root = document.createElement('div');
  root.className = 'am';
  root.hidden = true;
  root.innerHTML = `
    <div class="am__scrim" data-close></div>
    <div class="am__card" role="dialog" aria-modal="true" aria-labelledby="am-title" tabindex="-1">
      <div class="am__bar">
        <span class="am__pill"><i></i>Kynetic AI audit</span>
        <button type="button" class="am__x" data-close aria-label="Close">Close <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      </div>
      <div class="am__body">
        <div class="am__progress" aria-hidden="true"><span></span></div>
        <form class="am__step" data-step="1" novalidate>
          <h2 class="am__q" id="am-title"><b>01</b>Let's start with the basics.</h2>
          <p class="am__hint">Apply for your free AI audit. It takes about two minutes.</p>
          <label>Name<input name="name" type="text" autocomplete="name" placeholder="Jane Smith" required /></label>
          <label>Email<input name="email" type="email" autocomplete="email" placeholder="jane@example.com" required /></label>
          <input class="am__trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <p class="am__err" role="alert" hidden></p>
          <button class="am__btn" type="submit">OK</button>
          <p class="am__fine">By continuing you agree to our <a href="/terms/">Terms &amp; Conditions</a> and <a href="/privacy/">Privacy Policy</a>.</p>
        </form>
        <form class="am__step" data-step="2" hidden novalidate>
          <h2 class="am__q"><b>02</b>What's the best number to reach you?</h2>
          <p class="am__hint">We text to confirm your audit call.</p>
          <label>Phone number<input name="phone" type="tel" autocomplete="tel" placeholder="(201) 555-0123" required /></label>
          <p class="am__err" role="alert" hidden></p>
          <div class="am__row"><button class="am__back" type="button" data-back>Back</button><button class="am__btn" type="submit">OK</button></div>
          <p class="am__fine">By submitting your number you agree to get calls and texts from Kynetic AI about your audit and our services, which may use automated technology. Consent isn't a condition of purchase. Message and data rates may apply. Message frequency varies. Reply HELP for help or STOP to opt out.</p>
        </form>
        <form class="am__step" data-step="3" hidden novalidate>
          <h2 class="am__q"><b>03</b>Tell us about your business.</h2>
          <p class="am__hint">So we can look at it before the call.</p>
          <label>Business name<input name="company" type="text" autocomplete="organization" maxlength="200" required /></label>
          <label>Website <em>(optional)</em><input name="site" type="text" inputmode="url" autocomplete="url" placeholder="yourbusiness.com" maxlength="200" /></label>
          <p class="am__err" role="alert" hidden></p>
          <div class="am__row"><button class="am__back" type="button" data-back>Back</button><button class="am__btn" type="submit">OK</button></div>
        </form>
        ${choiceSteps}
        <div class="am__step am__done" data-step="book" hidden>
          <h2 class="am__q" id="am-book"></h2>
          <p>You're a strong fit. Pick a time for your AI audit. We'll text you to confirm the call.</p>
          <iframe class="am__cal" id="am-cal-frame" title="Book your AI audit call" loading="lazy"></iframe>
          <a class="am__link" id="am-cal" href="${CAL}" target="_blank" rel="noopener">Calendar not loading? Open it in a new tab</a>
        </div>
        <div class="am__step am__done" data-step="nofit" hidden>
          <p class="am__eyebrow">Thanks for applying</p>
          <h2 class="am__q" id="am-nofit">We're not the right fit yet.</h2>
          <p>Our audits and builds start at a higher investment than you selected, so we don't want to waste your time. Your answers are saved. If things change, apply again and we'll take another look.</p>
          <a class="am__btn" href="/" data-close>Back to the site</a>
        </div>
      </div>
    </div>`;
  document.body.append(root);

  const card = root.querySelector<HTMLElement>('.am__card')!;
  const bar = root.querySelector<HTMLElement>('.am__progress span')!;
  const stepEls = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-step]').forEach((s) => stepEls.set(s.dataset.step!, s));
  const forms = (n: number) => stepEls.get(String(n)) as HTMLFormElement;
  let opener: HTMLElement | null = null;
  let current = '1';
  let busy = false;

  const err = (form: HTMLElement, msg = '') => {
    const p = form.querySelector<HTMLElement>('.am__err');
    if (!p) return;
    p.textContent = msg;
    p.hidden = !msg;
  };
  const show = (id: string | number) => {
    current = String(id);
    stepEls.forEach((s, k) => (s.hidden = k !== current));
    const n = Number(current);
    bar.style.width = Number.isNaN(n) ? '100%' : `${Math.round((n / COUNT) * 100)}%`;
    const next = stepEls.get(current)!;
    const focusEl = next.querySelector<HTMLElement>('input:not(.am__trap):not([type=radio]), input[type=radio]:checked, .am__opt input, a.am__btn');
    (focusEl ?? card).focus({ preventScroll: true });
    card.scrollTop = 0;
    if (!reducedMotion()) animate(next, { opacity: [0, 1], y: [14, 0] }, { type: 'spring', stiffness: 260, damping: 28 });
  };
  const open = (from?: HTMLElement | null) => {
    opener = from ?? (document.activeElement as HTMLElement | null);
    root.hidden = false;
    document.documentElement.classList.add('am-lock');
    show(1);
    if (!reducedMotion()) {
      animate(root.querySelector('.am__scrim')!, { opacity: [0, 1] }, { duration: 0.2 });
      animate(card, { opacity: [0, 1], y: [24, 0], scale: [0.97, 1] }, { type: 'spring', stiffness: 300, damping: 30 });
    }
  };
  const close = () => {
    root.hidden = true;
    document.documentElement.classList.remove('am-lock');
    opener?.focus?.();
  };

  root.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('[data-close]');
    if (!c) return;
    if (c.tagName === 'A') e.preventDefault();
    close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') {
      // Typeform-style: press a letter to choose that option, then it moves on.
      const t = e.target as HTMLElement;
      const form = t.closest<HTMLFormElement>('form[data-choice]');
      if (form && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
        const idx = LETTERS.indexOf(e.key.toUpperCase());
        const radios = form.querySelectorAll<HTMLInputElement>('input[type=radio]');
        if (idx >= 0 && radios[idx]) { radios[idx].checked = true; radios[idx].focus(); queueAdvance(form); }
      }
      return;
    }
    const f = [...card.querySelectorAll<HTMLElement>('button, a[href], input:not(.am__trap), textarea, iframe')].filter((el) => !el.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { err(b.closest('form')!); show(Math.max(1, Number(current) - 1)); }));

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

  const val = (form: HTMLFormElement, n: string) => (form.elements.namedItem(n) as HTMLInputElement).value.trim();
  const focus = (form: HTMLFormElement, n: string) => (form.elements.namedItem(n) as HTMLElement).focus();

  // Steps 1-3: text answers, validated before moving on.
  forms(1).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = forms(1);
    if (!val(f, 'name')) { err(f, 'Please enter your name.'); focus(f, 'name'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val(f, 'email'))) { err(f, 'Please enter a valid email address.'); focus(f, 'email'); return; }
    err(f); show(2);
  });
  forms(2).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = forms(2);
    if ((val(f, 'phone').match(/\d/g) ?? []).length < 10) { err(f, 'Please enter a phone number with area code.'); focus(f, 'phone'); return; }
    err(f); show(3);
  });
  forms(3).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = forms(3);
    if (!val(f, 'company')) { err(f, 'Please enter your business name.'); focus(f, 'company'); return; }
    err(f); show(4);
  });

  // Steps 4-7: pick an option. Choosing one moves on after a beat; OK/Enter also works.
  let timer: number | undefined;
  const queueAdvance = (form: HTMLFormElement) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (current === form.dataset.step) form.requestSubmit(); }, 280);
  };
  CHOICES.forEach((c, i) => {
    const n = 4 + i;
    const f = forms(n);
    f.addEventListener('change', () => { if (n < COUNT) queueAdvance(f); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(timer);
      if (!f.querySelector('input[type=radio]:checked')) { err(f, 'Please pick one.'); return; }
      err(f);
      if (n < COUNT) show(n + 1); else void submit();
    });
  });

  const answer = (key: string) => (forms(4 + CHOICES.findIndex((c) => c.key === key)).querySelector<HTMLInputElement>('input:checked')?.value ?? '');

  async function submit() {
    if (busy) return;
    const f1 = forms(1), f2 = forms(2), f3 = forms(3), last = forms(COUNT);
    if (val(f1, 'website')) { show('book'); return; } // bot: pretend it worked, send nothing
    const name = val(f1, 'name'), email = val(f1, 'email'), phone = val(f2, 'phone'), company = val(f3, 'company'), site = val(f3, 'site');
    const answers = Object.fromEntries(CHOICES.map((c) => [c.key, answer(c.key)]));
    const qualified = answers.invest !== DISQUALIFY_INVEST;
    const message = [
      `AI audit application (${qualified ? 'QUALIFIED' : 'NOT A FIT YET: lowest investment band'})`,
      `Phone: ${phone} (agreed to calls and texts about the audit)`,
      `Business: ${company}${site ? ` (${site})` : ''}`,
      ...CHOICES.map((c) => `${c.label}: ${answers[c.key]}`),
      `Page: ${location.href}`,
    ].join('\n');
    const btn = last.querySelector<HTMLButtonElement>('button[type=submit]')!;
    busy = true; btn.disabled = true; btn.textContent = 'Sending…'; err(last);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, page: location.href, source: 'audit-application', phone, company, website: site, answers, qualified }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (qualified) {
        root.querySelector('#am-book')!.textContent = `Pick a time, ${name.split(' ')[0]}.`;
        const u = new URL(CAL); u.searchParams.set('name', name); u.searchParams.set('email', email);
        u.searchParams.set('notes', `${company}${site ? ` (${site})` : ''}`);
        root.querySelector<HTMLAnchorElement>('#am-cal')!.href = u.toString();
        const e = new URL(u); e.searchParams.set('embed', 'true'); e.searchParams.set('layout', 'month_view');
        root.querySelector<HTMLIFrameElement>('#am-cal-frame')!.src = e.toString();
        show('book');
      } else {
        show('nofit');
      }
      forms(1).reset(); forms(2).reset(); forms(3).reset(); CHOICES.forEach((_, i) => forms(4 + i).reset());
    } catch (error) {
      console.error('audit application:', error);
      err(last, 'Something went wrong sending that. Please try again, or email abdullah@kyneticai.com.');
    } finally {
      busy = false; btn.disabled = false; btn.textContent = 'Submit my application';
    }
  }
}
