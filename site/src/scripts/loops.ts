// The looping animations inside the service cards (bars, glow borders, waveforms, refresh icon, graph).
// Framer ran these from its own timers; here each cycle was recorded from the published site
// (tests/capture/tape.mjs -> scripts/build-loops.mjs -> loops.json) and is replayed on one clock.
import loops from './loops.json';
import { animate } from 'motion';
import { reducedMotion } from './appear';

type Track = { el: number; prop: string; tpl: string; pts: number[][] };
type Cycle = { period: number; tracks: Track[] };

const fill = (tpl: string, nums: number[]) => {
  let i = 0;
  return tpl.replace(/\u0000/g, () => String(nums[i++]));
};

function play(card: HTMLElement, cycle: Cycle) {
  const els = [card, ...card.querySelectorAll<HTMLElement>('*')];
  // the recorded glow-border gradients are dropped: the rebrand has no gradients or glows
  const tracks = cycle.tracks.filter((t) => !t.tpl.includes('gradient')).map((t) => ({ ...t, node: els[t.el] as HTMLElement }));
  const frame = (now: number) => {
    const phase = now % cycle.period;
    for (const t of tracks) {
      const pts = t.pts;
      // points sit on a regular grid except the closing one, so a short scan from the estimate is enough
      let j = Math.min(pts.length - 2, Math.floor((phase / cycle.period) * (pts.length - 1)));
      while (j > 0 && pts[j][0] > phase) j--;
      while (j < pts.length - 2 && pts[j + 1][0] <= phase) j++;
      const a = pts[j], b = pts[j + 1];
      const k = b[0] === a[0] ? 0 : (phase - a[0]) / (b[0] - a[0]);
      const nums = a.slice(1).map((v, n) => v + (b[n + 1] - v) * k);
      (t.node.style as any)[t.prop] = fill(t.tpl, nums.map((n) => Math.round(n * 1000) / 1000));
    }
  };
  return frame;
}

export function initLoops() {
  if (reducedMotion()) return;
  const runners: { card: HTMLElement; frames: ((now: number) => void)[]; visible: boolean }[] = [];
  for (const [name, cycles] of Object.entries(loops as unknown as Record<string, Cycle[]>)) {
    const card = document.querySelector<HTMLElement>(`[data-framer-name="${name}"]`);
    if (!card) continue;
    runners.push({ card, frames: cycles.map((c) => play(card, c)), visible: false });
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) runners.find((r) => r.card === e.target)!.visible = e.isIntersecting;
  }, { rootMargin: '100px' });
  runners.forEach((r) => io.observe(r.card));
  const tick = (now: number) => {
    for (const r of runners) if (r.visible) r.frames.forEach((f) => f(now));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Development card: code types itself word by word, shows a blank editor, and starts again.
// Cycle measured on the live site: 4.82s of text (first word after 0.43s, then one every 0.075s), 0.53s blank.
export function initCodeLoop() {
  const card = document.querySelector<HTMLElement>('[data-framer-name="Development card"]');
  const content = card?.querySelector<HTMLElement>('[data-framer-name="Main Content"]');
  if (!card || !content) return;
  const spans = [...content.querySelectorAll<HTMLElement>('span[style*="display:inline-block"][style*="opacity:0.001"]')];
  const paras = [...content.querySelectorAll<HTMLElement>('p')];
  const reset = () => spans.forEach((s) => { s.style.opacity = '0.001'; s.style.transform = 'translateY(10px)'; });
  if (reducedMotion()) { spans.forEach((s) => { s.style.opacity = '1'; s.style.transform = 'none'; }); return; }

  const TEXT_MS = 4815, BLANK_MS = 526, FIRST = 0.43, STEP = 0.075;
  let timer = 0, running: ReturnType<typeof animate>[] = [];
  const showText = () => {
    paras.forEach((p) => (p.style.visibility = ''));
    reset();
    running = spans.map((s, i) =>
      animate(s, { opacity: [0.001, 1], y: [10, 0] }, { type: 'spring', bounce: 0, duration: 0.4, delay: FIRST + i * STEP }));
    timer = window.setTimeout(showBlank, TEXT_MS);
  };
  const showBlank = () => {
    running.forEach((a) => a.stop());
    paras.forEach((p) => (p.style.visibility = 'hidden'));
    timer = window.setTimeout(showText, BLANK_MS);
  };
  let started = false;
  new IntersectionObserver((entries, io) => {
    if (entries.some((e) => e.isIntersecting) && !started) { started = true; showText(); io.disconnect(); }
  }, { threshold: 0.3 }).observe(card);
  void timer;
}
