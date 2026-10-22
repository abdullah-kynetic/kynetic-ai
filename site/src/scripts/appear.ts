// Hero entrance animations (page load). Source: the page's own appear-animation JSON.
import { animate } from 'motion';
import config from './appear.json';

type Frame = Record<string, number>;
type Entry = { default: { initial: Frame; animate: Frame & { transition: Record<string, any> } } };

const KEYS = ['opacity', 'x', 'y', 'scale', 'transformPerspective'];

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initAppear() {
  for (const [id, entry] of Object.entries(config as Record<string, Entry>)) {
    const el = document.querySelector<HTMLElement>(`[data-framer-appear-id="${id}"]`);
    if (!el) continue;
    const { initial, animate: to } = entry.default;
    const { transition, ...target } = to;
    if (reducedMotion()) {
      el.style.opacity = String(target.opacity);
      el.style.transform = 'none';
      continue;
    }
    const keyframes: Record<string, number[]> = {};
    for (const k of KEYS) if (k in target) keyframes[k] = [initial[k] ?? target[k], target[k]];
    const opts: Record<string, any> = { delay: transition.delay, duration: transition.duration };
    if (transition.type === 'spring') Object.assign(opts, { type: 'spring', bounce: transition.bounce });
    else Object.assign(opts, { ease: transition.ease });
    animate(el, keyframes, opts);
  }
}
