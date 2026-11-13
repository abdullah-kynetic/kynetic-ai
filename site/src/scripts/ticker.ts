// Hero logo strip: Framer "Ticker" settings from the original: direction left, speed 35px/s,
// gap 74px, hover slows to 0.5x. Children are repeated to fill the strip and the list slides by
// one repeat length per loop (linear, infinite).
import { reducedMotion } from './appear';

export function initTicker() {
  const section = document.querySelector<HTMLElement>('[data-framer-appear-id="1to47m6"] section');
  const ul = section?.querySelector<HTMLElement>('ul');
  if (!section || !ul) return;

  const GAP = 74;
  const SPEED = 35;
  const originals = [...ul.children] as HTMLElement[];
  const first = originals[0];
  const last = originals[originals.length - 1];
  const parent = section.offsetWidth;
  const childrenWidth = last.offsetLeft + last.offsetWidth - first.offsetLeft + GAP;
  const copies = Math.min(Math.round((parent / childrenWidth) * 2) + 1, 100);
  for (let i = 0; i < copies; i++) {
    originals.forEach((li) => {
      const c = li.cloneNode(true) as HTMLElement;
      c.setAttribute('aria-hidden', 'true');
      ul.appendChild(c);
    });
  }
  const distance = childrenWidth + childrenWidth * Math.round(parent / childrenWidth);
  section.style.opacity = '1';
  ul.style.willChange = 'transform';
  if (reducedMotion()) return;

  const anim = ul.animate(
    [{ transform: 'translateX(0px)' }, { transform: `translateX(-${distance}px)` }],
    { duration: (distance / SPEED) * 1000, iterations: Infinity, easing: 'linear' },
  );
  ul.addEventListener('mouseenter', () => (anim.playbackRate = 0.5));
  ul.addEventListener('mouseleave', () => (anim.playbackRate = 1));
}
