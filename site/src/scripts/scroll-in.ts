// Sections and cards that slide/fade in once when half of them is on screen.
// Starting states are in the markup (opacity 0 plus a translate); transitions are springs.
import { animate } from 'motion';
import { watchInView } from './in-view';
import { reducedMotion } from './appear';

const spring = (stiffness: number, damping: number, delay = 0) =>
  ({ type: 'spring', stiffness, damping, mass: 1, delay }) as const;

// Per-element overrides keyed by data-framer-name. Everything else uses the card spring.
const BY_NAME: Record<string, ReturnType<typeof spring>> = {
  'Switch button': spring(200, 45),
  'Basic Plan': spring(200, 45, 0),
  'Professional Plan': spring(200, 45, 0.15),
  'Enterprise Plan': spring(200, 45, 0.3),
  bento: spring(320, 60),
  header: spring(320, 70),
  Content: spring(320, 70), // y-offset sections; side-sliding "Content" blocks use the card spring below
  Questions: spring(320, 70),
  CTA: spring(320, 70),
};
const CARD = spring(200, 45);

export function initScrollIn() {
  const els = document.querySelectorAll<HTMLElement>('[style*="will-change:transform"][style*="opacity:0;"], [data-framer-name="Switch button"][style*="opacity:0"]');
  els.forEach((el) => {
    if (reducedMotion()) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      return;
    }
    const name = el.dataset.framerName || '';
    const slidesSideways = /translateX\(-?100px\)/.test(el.style.transform);
    const transition = slidesSideways ? CARD : BY_NAME[name] || CARD;
    const t = el.style.transform;
    const from = {
      x: Number(/translateX\((-?\d+)px\)/.exec(t)?.[1] ?? 0),
      y: Number(/translateY\((-?\d+)px\)/.exec(t)?.[1] ?? 0),
    };
    let done = false;
    watchInView(el, 0.5, () => {
      if (done) return; // plays once
      done = true;
      animate(el, { opacity: [0, 1], x: [from.x, 0], y: [from.y, 0] }, transition);
    });
  });
}
