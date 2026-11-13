// FAQ rows (component framer-Hzat5): each row toggles on its own. Opening adds the answer and the
// row grows to fit; closing removes the answer at once and the row shrinks back. The chevron flips.
import { animate } from 'motion';
import answers from './faq.json';
import { reducedMotion } from './appear';

const SPRING = { type: 'spring', stiffness: 500, damping: 50, mass: 1 } as const;
const CLOSED_V = 'framer-v-68kmee';
const OPEN_V = 'framer-v-1sootvm';
const CARET_DOWN = 'M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z';
const CARET_UP = 'M216.49,168.49a12,12,0,0,1-17,0L128,97,56.49,168.49a12,12,0,0,1-17-17l80-80a12,12,0,0,1,17,0l80,80A12,12,0,0,1,216.49,168.49Z';
const ANSWER_VAR = 'var(--token-8c14519b-b926-46e8-8772-9a05cbede172, #5c5650)';

function answerNode(html: string) {
  const wrap = document.createElement('div');
  wrap.className = 'framer-157179s';
  wrap.dataset.framerName = 'Answer';
  wrap.innerHTML =
    `<div class="framer-1di4gu7" data-framer-component-type="RichTextContainer" style="--extracted-r6o4lv:${ANSWER_VAR};--framer-link-text-color:var(--kn-accent-text);--framer-link-text-decoration:underline;--framer-paragraph-spacing:0px">` +
    `<p class="framer-text" style="--font-selector:R0Y7T3V0Zml0LXJlZ3VsYXI=;--framer-font-family:&quot;Inter&quot;,&quot;Inter Placeholder&quot;,sans-serif;--framer-line-height:1.5em;--framer-text-alignment:left;--framer-text-color:var(--extracted-r6o4lv,${ANSWER_VAR})">${html}</p></div>`;
  return wrap;
}

export function initFaq() {
  document.querySelectorAll<HTMLElement>('.framer-Hzat5').forEach((row, i) => {
    const data = answers[i];
    if (!data) return;
    const caret = () => row.querySelector('svg path');
    row.addEventListener('click', () => {
      const open = row.dataset.framerName === 'Open';
      const from = row.getBoundingClientRect().height;
      row.style.height = `${from}px`;
      if (open) {
        row.querySelector('[data-framer-name="Answer"]')?.remove();
        row.dataset.framerName = 'Closed';
        row.classList.replace(OPEN_V, CLOSED_V);
        caret()?.setAttribute('d', CARET_DOWN);
      } else {
        row.append(answerNode(data.a));
        row.dataset.framerName = 'Open';
        row.classList.replace(CLOSED_V, OPEN_V);
        caret()?.setAttribute('d', CARET_UP);
      }
      row.style.height = '';
      const to = row.getBoundingClientRect().height;
      if (reducedMotion()) return;
      animate(row, { height: [`${from}px`, `${to}px`] }, { ...SPRING, delay: open ? 0.06 : 0 }).then(() => (row.style.height = ''));
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });
  });
}
