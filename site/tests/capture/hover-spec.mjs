// Records what changes when each interactive component is hovered on the live site, so the rebuild
// can replay the same end states. For every target we compare computed styles of the element and all
// descendants before and after hover (after the animation settles).
// Usage: node tests/capture/hover-spec.mjs > src/scripts/hover-spec.json
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const TARGETS = {
  navLink: 'nav a.framer-520aC',
  button: 'a.framer-yPywB[href="./#plans"]',
  primary: 'a.framer-yPywB[href*="cal.com"]',
  social: 'a.framer-irbnn9',
  footerLink: 'footer a.framer-styles-preset-1cg0spb',
  submit: 'button.framer-NHy43',
  mobileLink: 'a.framer-1l2dhtw',
};
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto((process.env.BASE || 'https://kyneticai.com') + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
const H = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y <= H; y += 400) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(200); }

const snap = (sel) => page.evaluate((sel) => {
  const root = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 4 && e.offsetParent !== null);
  if (!root) return null;
  root.scrollIntoView({ block: 'center' });
  const res = {};
  const walk = (el, path) => {
    const cs = getComputedStyle(el);
    const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
    const rr = el.getBoundingClientRect(); const rt = root.getBoundingClientRect();
    res[path] = { opacity: cs.opacity, tx: m.e, ty: m.f, scale: m.a, bg: cs.backgroundColor, bc: cs.borderTopColor, color: cs.color, shadow: cs.boxShadow, fill: cs.fill, top: cs.top, left: cs.left, relY: Math.round((rr.y - rt.y) * 10) / 10, relX: Math.round((rr.x - rt.x) * 10) / 10, w: Math.round(rr.width), h: Math.round(rr.height), overflow: cs.overflow };
    [...el.children].forEach((c, i) => walk(c, path + '>' + i));
  };
  walk(root, '0');
  const r = root.getBoundingClientRect();
  return { res, x: r.x + r.width / 2, y: r.y + r.height / 2, cls: [...root.classList].join(' ') };
}, sel);

const spec = {};
for (const [name, sel] of Object.entries(TARGETS)) {
  await page.mouse.move(2, 2); await page.waitForTimeout(800);
  const a = await snap(sel);
  if (!a) { spec[name] = null; continue; }
  await page.waitForTimeout(600);
  const a2 = await snap(sel); // after scroll
  await page.mouse.move(a2.x, a2.y); await page.waitForTimeout(2200);
  const b = await snap(sel);
  const diffs = {};
  for (const [path, before] of Object.entries(a2.res)) {
    const after = b.res[path]; if (!after) continue;
    const d = {};
    for (const k of Object.keys(before)) if (before[k] !== after[k]) d[k] = after[k];
    if (Object.keys(d).length) diffs[path] = { from: Object.fromEntries(Object.keys(d).map((k) => [k, before[k]])), to: d };
  }
  spec[name] = { selector: sel, diffs };
  await page.mouse.move(2, 2);
}
console.log(JSON.stringify(spec, null, 1));
await browser.close();
