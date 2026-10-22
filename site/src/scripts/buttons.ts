// Button hover (component framer-yPywB): the label rolls up (a `hover` class flips the layout and
// the two text rows glide into place) and the outline brightens from 10% to 30% white.
// Spring: stiffness 300, damping 60.
import { animate } from 'motion';
import { reducedMotion } from './appear';

const SPRING = { type: 'spring', stiffness: 300, damping: 60, mass: 1 } as const;
const ROW = '.framer-16ny6i, .framer-hsjj43';

export function initButtons() {
  document.querySelectorAll<HTMLElement>('a.framer-yPywB').forEach((btn) => {
    const rows = [...btn.querySelectorAll<HTMLElement>(ROW)];
    const roll = (on: boolean) => {
      // layout flips at once; each row then animates from where it was (FLIP)
      const before = rows.map((r) => r.getBoundingClientRect().top);
      btn.classList.toggle('hover', on);
      if (reducedMotion()) return;
      rows.forEach((r, i) => {
        const dy = before[i] - r.getBoundingClientRect().top;
        if (dy) animate(r, { y: [dy, 0] }, SPRING);
      });
      animate(btn, { '--border-color': on ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)' }, SPRING);
    };
    btn.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && roll(true));
    btn.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && roll(false));
  });
}
