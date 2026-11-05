// "Book your free AI audit" overlay. Every audit button on the page (they link to the Cal booking page)
// opens this two-step dialog instead. Step 1 collects contact details, step 2 what they want help with.
// The answers post as JSON to the same n8n contact webhook the old bottom form used (name, email, message);
// the phone number and the answers travel inside `message`, so the workflow needs no change.
// After sending, the dialog offers the Cal booking page. Without JS the buttons still go to Cal.
import { animate } from 'motion';
import { reducedMotion } from './appear';

const ENDPOINT: string = import.meta.env.PUBLIC_CONTACT_WEBHOOK ?? 'https://n8n.kyneticai.com/webhook/website-contact';
const CAL = 'https://cal.com/abdullah-kyneticai/kynetic-ai-discovery-call';
const HELP = [
  'Winning and following up with customers',
  'Reviews and online reputation',
  'Operations and back-office',
  'A custom AI system or CRM',
  'A full AI overhaul',
  'Not sure yet',
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function initAuditModal() {
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
          <h2 class="am__q" id="am-title"><b>01</b>Where can we reach you?</h2>
          <label>Name<input name="name" type="text" autocomplete="name" placeholder="Jane" required /></label>
          <label>Email<input name="email" type="email" autocomplete="email" placeholder="jane@example.com" required /></label>
          <label>Phone number <em>(optional)</em><input name="phone" type="tel" autocomplete="tel" placeholder="(201) 555-0123" /></label>
          <input class="am__trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <p class="am__err" role="alert" hidden></p>
          <button class="am__btn" type="submit">Next</button>
          <p class="am__fine">If you add a phone number, you agree to get calls and texts from Kynetic AI at that number about your audit and our services, which may use automated technology. Consent isn't a condition of purchase. Message and data rates may apply. Message frequency varies. Reply HELP for help or STOP to opt out.</p>
          <p class="am__fine">By continuing you agree to our <a href="/terms/">Terms &amp; Conditions</a> and <a href="/privacy/">Privacy Policy</a>.</p>
        </form>
        <form class="am__step" data-step="2" hidden novalidate>
          <h2 class="am__q"><b>02</b>What would you like help with?</h2>
          <fieldset class="am__chips"><legend class="am__sr">Pick any that apply</legend>
            ${HELP.map((h, i) => `<label class="am__chip"><input type="checkbox" name="help" value="${esc(h)}" id="am-h${i}" /><span>${esc(h)}</span></label>`).join('')}
          </fieldset>
          <label>Business and what it does <em>(optional)</em><input name="business" type="text" maxlength="200" /></label>
          <label>Anything we should know? <em>(optional)</em><textarea name="notes" rows="3" maxlength="600"></textarea></label>
          <p class="am__err" role="alert" hidden></p>
          <div class="am__row"><button class="am__back" type="button" data-back>Back</button><button class="am__btn" type="submit">Request my free audit</button></div>
        </form>
        <div class="am__step am__done" data-step="3" hidden>
          <h2 class="am__q" id="am-done"></h2>
          <p>We'll be in touch. If you'd rather pick a time right now, choose a slot for your free audit call.</p>
          <a class="am__btn" id="am-cal" href="${CAL}" target="_blank" rel="noopener">Pick a time</a>
        </div>
      </div>
    </div>`;
  document.body.append(root);

  const card = root.querySelector<HTMLElement>('.am__card')!;
  const bar = root.querySelector<HTMLElement>('.am__progress span')!;
  const steps = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const f1 = steps[0] as HTMLFormElement, f2 = steps[1] as HTMLFormElement;
  let opener: HTMLElement | null = null;
  let current = 1;
  let busy = false;

  const err = (form: HTMLElement, msg = '') => {
    const p = form.querySelector<HTMLElement>('.am__err')!;
    p.textContent = msg;
    p.hidden = !msg;
  };
  const show = (n: number) => {
    current = n;
    steps.forEach((s) => (s.hidden = s.dataset.step !== String(n)));
    bar.style.width = `${n === 1 ? 33 : n === 2 ? 66 : 100}%`;
    const next = steps[n - 1];
    const focusEl = next.querySelector<HTMLElement>('input:not(.am__trap), textarea, a.am__btn');
    focusEl?.focus({ preventScroll: true });
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

  root.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-close]')) close(); });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    const f = [...card.querySelectorAll<HTMLElement>('button, a[href], input:not(.am__trap), textarea')].filter((el) => !el.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  root.querySelector('[data-back]')!.addEventListener('click', () => show(1));

  // Every audit button (the Cal link) and any [data-audit-open] opens the dialog.
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('a[href*="cal.com/abdullah-kyneticai"], [data-audit-open]');
    if (!a || a.closest('.am')) return;
    e.preventDefault();
    open(a);
  });
  if (location.hash === '#audit') open();

  f1.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (f1.elements.namedItem('name') as HTMLInputElement).value.trim();
    const email = (f1.elements.namedItem('email') as HTMLInputElement).value.trim();
    if (!name) { err(f1, 'Please enter your name.'); (f1.elements.namedItem('name') as HTMLElement).focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err(f1, 'Please enter a valid email address.'); (f1.elements.namedItem('email') as HTMLElement).focus(); return; }
    err(f1);
    show(2);
  });

  f2.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const v1 = (n: string) => (f1.elements.namedItem(n) as HTMLInputElement).value.trim();
    const v2 = (n: string) => (f2.elements.namedItem(n) as HTMLInputElement).value.trim();
    const name = v1('name'), email = v1('email'), phone = v1('phone');
    if (v1('website')) { show(3); return; } // bot: pretend it worked, send nothing
    const help = [...f2.querySelectorAll<HTMLInputElement>('input[name=help]:checked')].map((c) => c.value);
    const message = [
      'AI audit request',
      `Phone: ${phone || 'not given'}${phone ? ' (agreed to calls and texts about the audit)' : ''}`,
      `Business: ${v2('business') || 'not given'}`,
      `Wants help with: ${help.join('; ') || 'not specified'}`,
      `Notes: ${v2('notes') || 'none'}`,
      `Page: ${location.href}`,
    ].join('\n');
    const btn = f2.querySelector<HTMLButtonElement>('button[type=submit]')!;
    busy = true; btn.disabled = true; btn.textContent = 'Sending…'; err(f2);
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, message, page: location.href }) });
      if (!res.ok) throw new Error(String(res.status));
      root.querySelector('#am-done')!.textContent = `Thank you, ${name.split(' ')[0]}.`;
      const u = new URL(CAL); u.searchParams.set('name', name); u.searchParams.set('email', email);
      root.querySelector<HTMLAnchorElement>('#am-cal')!.href = u.toString();
      show(3);
      f1.reset(); f2.reset();
    } catch (error) {
      console.error('audit request:', error);
      err(f2, 'Something went wrong sending that. Please try again, or email abdullah@kyneticai.com.');
    } finally {
      busy = false; btn.disabled = false; btn.textContent = 'Request my free audit'
    }
  });
}
