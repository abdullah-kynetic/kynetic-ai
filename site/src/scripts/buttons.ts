// Button hover (component framer-yPywB): the label rolls up (a `hover` class flips the layout and
// the two text rows glide into place), the champagne outline brightens and the orange fill lifts to #E57A42.
// Spring: stiffness 300, damping 60.
import { animate } from 'motion';
import { reducedMotion } from './appear';

const SPRING = { type: 'spring', stiffness: 300, damping: 60, mass: 1 } as const;
const ROW = '.framer-16ny6i, .framer-hsjj43';

export function initButtons() {
  document.querySelectorAll<HTMLElement>('a.framer-yPywB').forEach((btn) => {
    const rows = [...btn.querySelectorAll<HTMLElement>(ROW)];
    const orange = btn.style.backgroundColor === 'rgb(217, 102, 42)';
    if (orange) btn.classList.add('kn-orange'); // keeps the near-black label while the fill animates
    const roll = (on: boolean) => {
      // layout flips at once; each row then animates from where it was (FLIP)
      const before = rows.map((r) => r.getBoundingClientRect().top);
      btn.classList.toggle('hover', on);
      if (reducedMotion()) return;
      rows.forEach((r, i) => {
        const dy = before[i] - r.getBoundingClientRect().top;
        if (dy) animate(r, { y: [dy, 0] }, SPRING);
      });
      animate(btn, { '--border-color': on ? 'rgba(138, 106, 47, 0.6)' : 'rgba(138, 106, 47, 0.3)' }, SPRING);
      if (orange) animate(btn, { backgroundColor: on ? 'rgb(229, 122, 66)' : 'rgb(217, 102, 42)' }, SPRING);
    };
    btn.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && roll(true));
    btn.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && roll(false));
  });
}
