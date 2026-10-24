// Contact form. The original Framer form posted to Framer's own endpoint; this one posts JSON to
// PUBLIC_CONTACT_WEBHOOK (an n8n webhook). Button states follow the original component
// (framer-NHy43): hover/press colours, a spinner while sending, "Thank you" or "Something went wrong".
import { animate } from 'motion';

const ENDPOINT: string = import.meta.env.PUBLIC_CONTACT_WEBHOOK ?? '';
const TWEEN = { duration: 0.2, ease: [0.44, 0, 0.56, 1] } as const;
const BG = { rest: 'rgb(217, 102, 42)', hover: 'rgb(229, 122, 66)', press: 'rgb(194, 85, 34)', error: 'rgba(0, 0, 0, 0)' };

export function initForm() {
  document.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
    // keep the "empty" class in sync so placeholder/focus styles behave as before
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.framer-form-input').forEach((f) => {
      const sync = () => f.classList.toggle('framer-form-input-empty', f.value === '');
      f.addEventListener('input', sync);
      sync();
    });

    const buttons = [...form.querySelectorAll<HTMLButtonElement>('button[type=submit]')];
    let busy = false;
    let state: 'idle' | 'loading' | 'success' | 'error' = 'idle';

    const paint = (btn: HTMLButtonElement, bg: string) => animate(btn, { backgroundColor: bg }, TWEEN);
    const label = (btn: HTMLButtonElement) => btn.querySelector<HTMLElement>('p')!;

    buttons.forEach((btn) => {
      const p = label(btn);
      const original = p.textContent!;
      const idleBg = () => (state === 'error' ? BG.error : BG.rest);
      btn.addEventListener('pointerenter', () => state === 'idle' && paint(btn, BG.hover));
      btn.addEventListener('pointerleave', () => state === 'idle' && paint(btn, BG.rest));
      btn.addEventListener('pointerdown', () => state === 'idle' && paint(btn, BG.press));
      btn.addEventListener('pointerup', () => state === 'idle' && paint(btn, BG.hover));
      (btn as any)._set = (next: typeof state) => {
        state = next;
        btn.dataset.state = next; // styled in components.css
        btn.querySelector('.kn-spin')?.remove();
        p.style.display = '';
        p.style.color = '';
        btn.style.opacity = '1';
        if (next === 'idle') { p.textContent = original; paint(btn, BG.rest); }
        if (next === 'loading') {
          p.style.display = 'none';
          const s = document.createElement('div');
          s.className = 'kn-spin';
          btn.append(s);
          animate(s, { rotate: 360 }, { duration: 1, ease: 'linear', repeat: Infinity });
        }
        if (next === 'success') { p.textContent = 'Thank you'; paint(btn, BG.rest); }
        if (next === 'error') { p.textContent = 'Something went wrong'; paint(btn, idleBg()); }
      };
    });
    const setAll = (s: typeof state) => buttons.forEach((b) => (b as any)._set(s));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const data = Object.fromEntries(new FormData(form).entries());
      // hidden decoy fields: anything in them means a bot, so act as if it worked and send nothing
      const decoys = ['website', 'company', 'message', 'subject', 'title', 'description', 'feedback', 'notes', 'details', 'url', 'phone'];
      if (decoys.some((k) => String(data[k] ?? '') !== '')) return setAll('success');
      busy = true;
      setAll('loading');
      try {
        if (!ENDPOINT) throw new Error('PUBLIC_CONTACT_WEBHOOK is not set');
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.Name, email: data.Email, message: data.Message, page: location.href }),
        });
        if (!res.ok) throw new Error(String(res.status));
        setAll('success');
        form.reset();
      } catch (err) {
        console.error('contact form:', err);
        setAll('error');
        setTimeout(() => setAll('idle'), 4000);
      } finally {
        busy = false;
      }
    });
  });
}
