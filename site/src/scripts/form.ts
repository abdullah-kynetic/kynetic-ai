// Contact form, one question at a time. Posts JSON to PUBLIC_CONTACT_WEBHOOK (an n8n webhook).
// Payload: name, email, message (required by the workflow) plus business, interest, page, website (honeypot).
// The optional answers are also folded into `message`, so the workflow stores them without any change.
const ENDPOINT: string = import.meta.env.PUBLIC_CONTACT_WEBHOOK ?? 'https://n8n.kyneticai.com/webhook/website-contact';

export function initForm() {
  const form = document.getElementById('kn-cf') as HTMLFormElement | null;
  if (!form) return;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const steps = [...form.querySelectorAll<HTMLElement>('.kn-cf-step')];
  const count = $('kn-cf-count'), bar = $('kn-cf-bar'), back = $<HTMLButtonElement>('kn-cf-back');
  const skip = $<HTMLButtonElement>('kn-cf-skip'), next = $<HTMLButtonElement>('kn-cf-next'), fail = $('kn-cf-fail');
  const val = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement)?.value ?? '').trim();
  let i = 0, busy = false;

  const focusStep = () => {
    const el = steps[i].querySelector<HTMLElement>('input:checked, input, textarea');
    el?.focus({ preventScroll: false });
  };
  const show = (n: number, move = true) => {
    i = n;
    steps.forEach((s, k) => (s.hidden = k !== i));
    const last = i === steps.length - 1;
    count.textContent = `Question ${i + 1} of ${steps.length}`;
    bar.style.width = `${((i + 1) / steps.length) * 100}%`;
    back.hidden = i === 0;
    skip.hidden = !steps[i].hasAttribute('data-optional');
    next.textContent = last ? 'Send message' : 'Continue';
    fail.textContent = '';
    $('kn-cf-keys').hidden = last;
    if (move) focusStep();
  };

  const check = (): boolean => {
    const el = steps[i].querySelector<HTMLInputElement | HTMLTextAreaElement>('input[required], textarea[required]');
    if (!el) return true;
    const err = $(`kn-cf-err-${el.name}`);
    let msg = '';
    if (!el.value.trim()) msg = el.name === 'email' ? 'Please enter your email address.' : el.name === 'name' ? 'Please enter your name.' : 'Please write a short message.';
    else if (el.type === 'email' && !el.validity.valid) msg = 'That email address does not look right. Check it and try again.';
    err.textContent = msg;
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) el.focus();
    return !msg;
  };
  form.querySelectorAll<HTMLInputElement>('.kn-cf-in').forEach((el) =>
    el.addEventListener('input', () => { el.setAttribute('aria-invalid', 'false'); const e = document.getElementById(`kn-cf-err-${el.name}`); if (e) e.textContent = ''; }));

  const send = async () => {
    if (busy) return;
    busy = true; next.disabled = true; next.textContent = 'Sending...'; fail.textContent = '';
    const business = val('business'), interest = (form.querySelector<HTMLInputElement>('input[name=interest]:checked')?.value) ?? '';
    const note = [business && `Business: ${business}`, interest && `Interested in: ${interest}`].filter(Boolean).join('\n');
    const message = (note ? `${note}\n\n` : '') + val('message');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: val('name'), email: val('email'), message, business, interest, website: val('website'), page: location.href }),
      });
      if (!res.ok) throw new Error(String(res.status));
      $('kn-cf-done-t').textContent = `Thank you, ${val('name').split(' ')[0]}.`;
      $('kn-cf-done-b').textContent = `Your message is in. We will reply to ${val('email')}.`;
      form.classList.add('is-done');
      const done = $('kn-cf-done'); done.hidden = false; done.focus();
    } catch (err) {
      console.error('contact form:', err);
      fail.textContent = 'Something went wrong and your message was not sent. Try again, or email abdullah@kyneticai.com.';
      next.disabled = false; next.textContent = 'Send message';
    } finally { busy = false; }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!check()) return;
    if (i < steps.length - 1) show(i + 1); else send();
  });
  back.addEventListener('click', () => i > 0 && show(i - 1));
  skip.addEventListener('click', () => { if (i < steps.length - 1) show(i + 1); });
  // Enter in the message box adds a line; Ctrl or Cmd + Enter sends.
  form.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' && e.key === 'Enter' && !(e.ctrlKey || e.metaKey)) e.stopPropagation();
    if (t.tagName === 'TEXTAREA' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
  }, true);
  show(0, false);
}
