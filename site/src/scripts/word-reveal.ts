// Word-by-word heading reveals. The markup wraps each word in an inline-block span that starts
// at opacity 0.001 and 10px low. Two styles exist on the site:
//   rise:  fade + rise, spring (bounce 0, 0.4s), 0.075s per word, every time it enters view, threshold 0.5
//   blur:  blur(10px) -> 0 + rise, spring (stiffness 400, damping 100), 0.05s per word, once, 0.5s start delay
import { animate } from 'motion';
import { watchInView } from './in-view';
import { reducedMotion } from './appear';

const words = (root: Element, blur: boolean) =>
  [...root.querySelectorAll<HTMLElement>('span[style*="display:inline-block"][style*="opacity:0.001"]')].filter(
    (s) => s.style.filter.includes('blur') === blur,
  );

const group = (blur: boolean) => {
  const map = new Map<Element, HTMLElement[]>();
  for (const s of words(document.body, blur)) {
    if (s.closest('[data-framer-name="Development card"]')) continue; // typed in a loop, see loops.ts
    const host = s.closest('p, h1, h2, h3, h4, h5, h6') || s.parentElement!;
    (map.get(host) ?? map.set(host, []).get(host)!).push(s);
  }
  return map;
};

const hide = (spans: HTMLElement[], blur: boolean) =>
  spans.forEach((s) => {
    s.style.opacity = '0.001';
    s.style.transform = 'translateY(10px)';
    if (blur) s.style.filter = 'blur(10px)';
  });

export function initWordReveal() {
  if (reducedMotion()) {
    for (const blur of [false, true]) for (const s of words(document.body, blur)) {
      s.style.opacity = '1';
      s.style.transform = 'none';
      s.style.filter = 'none';
    }
    return;
  }

  // rise style: repeats each time the text enters view
  for (const [host, spans] of group(false)) {
    watchInView(
      host,
      0.5,
      () =>
        spans.forEach((s, i) =>
          animate(s, { opacity: [0.001, 1], y: [10, 0] }, { type: 'spring', bounce: 0, duration: 0.4, delay: i * 0.075 }),
        ),
      () => hide(spans, false),
    );
  }

  // blur style: plays once
  for (const [host, spans] of group(true)) {
    let done = false;
    watchInView(host, 0, () => {
      if (done) return;
      done = true;
      spans.forEach((s, i) =>
        animate(
          s,
          { opacity: [0.001, 1], y: [10, 0], filter: ['blur(10px)', 'blur(0px)'] },
          { type: 'spring', stiffness: 400, damping: 100, mass: 1, delay: 0.5 + i * 0.05 },
        ),
      );
    });
  }
}
