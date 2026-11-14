// Free AI Score section (front end only). Steps: business, five tap-to-answer questions, a short "running" state, results.
// The results are SAMPLE content and are labelled as such on the page. The engine behind it (Google Places, PageSpeed,
// AI visibility, scoring, PDF, email, lead save) is not built yet: see KI-042 in docs/known-issues.md.
// `data-gate` on the section is the email-gate toggle (before | partial | after); it is read here but not used until the engine exists.
import { animate } from 'motion';
import { reducedMotion } from './appear';

export function initScore() {
  const root = document.querySelector<HTMLElement>('[data-score]');
  if (!root) return;
  const steps = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => steps.set(el.dataset.step!, el));
  const order = ['1', '2', '3', '4', '5', '6', 'run', 'result'];
  const fill = root.querySelector<HTMLElement>('[data-fill]')!;
  const count = root.querySelector<HTMLElement>('[data-count]')!;
  const answers: Record<string, string> = {};
  let timers: number[] = [];

  const show = (id: string, focus = true) => {
    steps.forEach((el, k) => { el.hidden = k !== id; });
    const i = order.indexOf(id);
    fill.style.width = `${Math.round(((i + 1) / order.length) * 100)}%`;
    count.textContent = id === 'result' ? 'Your AI Score' : id === 'run' ? 'Running' : `Step ${id === '1' ? 1 : 2} of 4`;
    const el = steps.get(id)!;
    if (!reducedMotion()) animate(el, { opacity: [0, 1], y: [10, 0] }, { duration: 0.25 });
    if (focus && id !== 'run') window.setTimeout(() => el.querySelector<HTMLElement>('input:not([type=radio]):not([type=checkbox]), button')?.focus({ preventScroll: true }), 50);
  };
  const err = (form: HTMLElement, msg: string) => { const e = form.querySelector<HTMLElement>('.np-score__err'); if (e) { e.textContent = msg; e.hidden = !msg; } };

  const run = () => {
    show('run');
    const items = [...root.querySelectorAll<HTMLElement>('[data-check]')];
    items.forEach((li) => li.classList.remove('is-done'));
    items.forEach((li, i) => timers.push(window.setTimeout(() => li.classList.add('is-done'), 500 + i * 650)));
    timers.push(window.setTimeout(() => {
      const t = root.querySelector<HTMLElement>('[data-result-title]')!;
      t.textContent = answers.biz ? `Your AI Score: ${answers.biz}` : 'Your AI Score';
      show('result');
    }, 500 + items.length * 650 + 300));
  };

  // Step 1
  const f1 = steps.get('1') as HTMLFormElement;
  f1.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (n: string) => ((f1.elements.namedItem(n) as HTMLInputElement).value || '').trim();
    if (!v('biz')) return err(f1, 'Please enter your business name.');
    if (!v('industry')) return err(f1, 'Please pick or type your industry.');
    err(f1, '');
    answers.biz = v('biz'); answers.industry = v('industry');
    show('2');
  });
  // Question steps: tap an answer to move on
  ['2', '3', '4', '5', '6'].forEach((id, i) => {
    const f = steps.get(id) as HTMLFormElement;
    f.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.type !== 'radio') return;
      answers[t.name] = t.value;
      window.setTimeout(() => (i === 4 ? run() : show(String(i + 3))), 220);
    });
    f.addEventListener('submit', (e) => e.preventDefault());
    f.querySelector('[data-back]')!.addEventListener('click', () => show(String(i + 1)));
  });
  // Result actions
  root.querySelectorAll<HTMLElement>('[data-todo-backend]').forEach((b) => b.addEventListener('click', () => { root.querySelector<HTMLElement>('[data-note]')!.hidden = false; }));
  root.querySelector('[data-restart]')!.addEventListener('click', () => {
    timers.forEach(clearTimeout); timers = [];
    root.querySelectorAll<HTMLFormElement>('form').forEach((f) => f.reset());
    root.querySelector<HTMLElement>('[data-note]')!.hidden = true;
    Object.keys(answers).forEach((k) => delete answers[k]);
    show('1');
  });
  show('1', false);
}
