// Record every visual change inside a looping card on the live page, frame by frame.
// Usage: node tests/capture/tape.mjs "<data-framer-name>" [seconds] [width] > out.json
// Output: { elements: [{i, path, tag, name}], frames: [[t, {i: {prop: value}}]] } (changes only).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const [name, secs = '16', width = '1440'] = process.argv.slice(2);
const base = process.env.BASE || 'https://kyneticai.com';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: +width, height: 900 } })).newPage();
await p.goto(base + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const root = p.locator(`[data-framer-name="${name}"]`).first();
await root.scrollIntoViewIfNeeded();
await p.evaluate((n) => { const r = document.querySelector(`[data-framer-name="${n}"]`); scrollTo(0, r.getBoundingClientRect().top + scrollY - 200); }, name);
await p.waitForTimeout(1200);
const res = await p.evaluate(([name, ms]) => new Promise((resolve) => {
  const card = document.querySelector(`[data-framer-name="${name}"]`);
  const els = [card, ...card.querySelectorAll('*')];
  const cr = card.getBoundingClientRect();
  const meta = els.map((e, i) => ({ i, tag: e.tagName.toLowerCase(), name: e.dataset?.framerName || '', cls: (e.getAttribute('class') || '').split(' ').find((c) => /^framer-/.test(c)) || '' }));
  const last = els.map(() => ({}));
  const frames = [];
  const t0 = performance.now();
  const r2 = (n) => Math.round(n * 100) / 100;
  const read = (e) => {
    const c = getComputedStyle(e), r = e.getBoundingClientRect();
    const o = { op: c.opacity, tr: c.transform, bg: c.backgroundColor, col: c.color, x: r2(r.left - cr.left), y: r2(r.top - cr.top), w: r2(r.width), h: r2(r.height), fl: c.filter, bs: c.boxShadow, bi: c.backgroundImage.slice(0, 200), bc: c.borderTopColor, dis: c.display, vis: c.visibility };
    if (e.children.length === 0 || e.tagName === 'P' || e.tagName === 'SPAN') { const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''); if (t) o.txt = t; }
    if (e.tagName === 'path') { o.d = e.getAttribute('d'); o.so = c.strokeDashoffset; o.sd = c.strokeDasharray; }
    if (e.tagName === 'svg') o.vb = e.getAttribute('viewBox');
    return o;
  };
  const f = () => {
    const now = performance.now() - t0, diff = {};
    els.forEach((e, i) => {
      const cur = read(e), prev = last[i], d = {};
      for (const k in cur) if (cur[k] !== prev[k]) d[k] = cur[k];
      if (Object.keys(d).length) { diff[i] = d; last[i] = cur; }
    });
    frames.push([Math.round(now), diff]);
    now < ms ? requestAnimationFrame(f) : resolve({ elements: meta, frames });
  };
  requestAnimationFrame(f);
}), [name, +secs * 1000]);
console.log(JSON.stringify(res));
await b.close();
