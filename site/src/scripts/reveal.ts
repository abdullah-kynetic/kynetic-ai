// Staggered scroll-in for the hand-built sections (journey steps, system cards, pricing steps, FAQ items).
// Elements marked [data-reveal] start hidden only once this script adds .js-reveal, so without JS the page is fully visible.
import { animate } from 'motion';
import { reducedMotion } from './appear';

export function initReveal() {
  if (reducedMotion()) document.querySelectorAll<SVGSVGElement>('.kn-map svg').forEach((s) => s.pauseAnimations());
  const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (!els.length || reducedMotion()) return;
  document.documentElement.classList.add('js-reveal');
  const seen = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => {
    const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement).filter((el) => !seen.has(el));
    batch.forEach((el, i) => {
      seen.add(el);
      io.unobserve(el);
      animate(el, { opacity: [0, 1], y: [24, 0] }, { type: 'spring', stiffness: 220, damping: 30, delay: i * 0.08 });
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}
