// WCAG contrast audit of the built site (static server on :4321 serving dist/).
// Usage: node tests/contrast.mjs [--out /path/dir]
// Checks every visible text element (4.5:1, 3:1 for large text), form-field borders and focus rings (3:1).
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const outDir = arg('out', '/workspace/brand-revamp-review');
const base = arg('base', 'http://localhost:4321');
const exe = '/opt/pw-browsers/chromium';
const pages = ['/', '/privacy/', '/terms/', '/roi-calculator/'];
const widths = [1440, 390];

// Runs in the page: returns raw findings with ratios computed in-page.
function audit() {
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const blend = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cl = [...el.classList].slice(0, 2).join('.');
    if (cl) s += '.' + cl;
    return s;
  };
  // Effective opaque background: walk ancestors, stack translucent layers, stop at the first opaque one.
  const bgOf = (el) => {
    const layers = []; let unknown = '';
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none' && !unknown) unknown = cs.backgroundImage.slice(0, 40);
      // Backdrops painted by a ::before / ::after behind the content (z-index < 0), e.g. the closing CTA band
      if (e !== el || true) for (const ps of ['::before', '::after']) {
        const pc = getComputedStyle(e, ps);
        if (pc.content !== 'none' && pc.position === 'absolute' && parseInt(pc.zIndex) < 0) {
          const r = e.getBoundingClientRect(), t = el.getBoundingClientRect();
          const pcol = parse(pc.backgroundColor);
          if (pcol && pcol.a > 0 && t.bottom <= r.bottom + parseFloat(pc.bottom) * -1 + 1) { layers.push(pcol); if (pcol.a >= 1) { e = null; break; } }
        }
      }
      if (!e) break;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    if (layers.length && layers[layers.length - 1].a >= 1) bg = layers.pop();
    while (layers.length) bg = blend(layers.pop(), bg);
    return { bg, unknown };
  };
  const opacityOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (e.hasAttribute('aria-hidden') && e.getAttribute('aria-hidden') === 'true' && false) return false;
    }
    return true;
  };
  const text = [], other = []; let skippedCode = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(el.tagName.toUpperCase())) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own || !visible(el)) continue;
    // Decorative code-typing illustration in the process cards: characters fade in one by one under a fade overlay
    if (el.closest('code')) { skippedCode++; continue; }
    const cs = getComputedStyle(el);
    let fg = parse(cs.webkitTextFillColor && cs.webkitTextFillColor.startsWith('rgb') ? cs.webkitTextFillColor : cs.color);
    if (!fg) continue;
    const { bg, unknown } = bgOf(el);
    const op = opacityOf(el);
    const eff = blend({ ...fg, a: fg.a * op }, bg);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const r = ratio(eff, bg);
    text.push({ sel: sel(el), text: own.slice(0, 50), fg: hex(eff), bg: hex(bg), ratio: +r.toFixed(2), size, weight, large, need: large ? 3 : 4.5, pass: r >= (large ? 3 : 4.5), bgImage: unknown || undefined });
  }
  // Form field edges: border or box-shadow ring on the field or its wrapper, versus the surface behind
  for (const el of document.querySelectorAll('input:not([type=hidden]), textarea, select')) {
    if (!visible(el)) continue;
    if (el.type === 'checkbox' || el.type === 'radio') continue; // native control, drawn by the browser
    if (el.type === 'range') { // the track is the identifying edge
      const { bg } = bgOf(el.parentElement || el);
      const tr = blend(parse(getComputedStyle(el).backgroundColor), bg), r = ratio(tr, bg);
      other.push({ kind: 'field-edge', sel: sel(el) + ' (range track)', fg: hex(tr), bg: hex(bg), ratio: +r.toFixed(2), need: 3, pass: r >= 3 });
      continue;
    }
    const chain = [el, el.parentElement, el.parentElement?.parentElement].filter(Boolean);
    const { bg } = bgOf(el.parentElement || el);
    let edge = null, src = '';
    for (const e of chain) {
      const cs = getComputedStyle(e);
      const bw = parseFloat(cs.borderTopWidth);
      const bc = parse(cs.borderTopColor);
      if (bw > 0 && bc && bc.a > 0 && cs.borderTopStyle !== 'none') { edge = bc; src = sel(e) + ' border'; break; }
      const ol = (cs.boxShadow.match(/rgba?\([^)]+\)/) || [])[0];
      if (ol && cs.boxShadow !== 'none') { edge = parse(ol); src = sel(e) + ' shadow'; break; }
      // Framer paints the edge with ::after border using --framer-input-border-color
      const fc = parse(cs.getPropertyValue('--framer-input-border-color').trim() || '');
      const after = getComputedStyle(e, '::after');
      const ab = parseFloat(after.borderTopWidth), ac = parse(after.borderTopColor);
      if (ab > 0 && ac && ac.a > 0) { edge = ac; src = sel(e) + '::after border'; break; }
      if (fc) { edge = fc; src = sel(e) + ' --framer-input-border-color'; break; }
    }
    if (!edge) { other.push({ kind: 'field-edge', sel: sel(el), ratio: 0, pass: false, note: 'no edge found' }); continue; }
    const e2 = blend(edge, bg);
    const r = ratio(e2, bg);
    other.push({ kind: 'field-edge', sel: sel(el), src, fg: hex(e2), bg: hex(bg), ratio: +r.toFixed(2), need: 3, pass: r >= 3 });
  }
  return { text, other, skippedCode };
}

const focusables = 'a[href], button, input:not([type=hidden]), textarea, select, summary, [tabindex="0"]';

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const results = [], skipped = [];
for (const w of widths) {
  for (const path of pages) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await page.goto(base + path, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= H; y += 300) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(500); }
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    const { text, other, skippedCode } = await page.evaluate(audit);
    skipped.push({ page: path, width: w, skippedCode });
    // Focus rings: tab through focusables, read outline vs surface
    const n = await page.locator(focusables).count();
    for (let i = 0; i < Math.min(n, 80); i++) {
      const loc = page.locator(focusables).nth(i);
      if (!(await loc.isVisible().catch(() => false))) continue;
      if ((await loc.getAttribute('tabindex')) === '-1') continue; // not in the tab order
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await page.keyboard.press('Tab').catch(() => {}); // enter keyboard modality
      await loc.focus().catch(() => {});
      const f = await loc.evaluate((el) => {
        const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const blend = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a) });
        const lum = (c) => { const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * g(c.r) + 0.7152 * g(c.g) + 0.0722 * g(c.b); };
        const cs = getComputedStyle(el);
        const oc = parse(cs.outlineColor);
        let bg = { r: 255, g: 255, b: 255 }; const layers = [];
        const t = el.getBoundingClientRect();
        outer: for (let e = el.parentElement; e; e = e.parentElement) {
          // backdrops painted by a ::before / ::after behind the content (the espresso CTA band)
          for (const ps of ['::before', '::after']) {
            const pc = getComputedStyle(e, ps), pcol = parse(pc.backgroundColor), r = e.getBoundingClientRect();
            if (pc.content !== 'none' && pc.position === 'absolute' && parseInt(pc.zIndex) < 0 && pcol && pcol.a > 0 && t.bottom <= r.bottom + parseFloat(pc.bottom) * -1 + 1) { layers.push(pcol); if (pcol.a >= 1) break outer; }
          }
          const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
        }
        if (layers.length && layers[layers.length - 1].a >= 1) bg = layers.pop();
        while (layers.length) bg = blend(layers.pop(), bg);
        const h = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
        const vis = el.matches(':focus-visible');
        const wrapperFocus = el.closest('.framer-form-input-wrapper, .inbox');
        const wc = wrapperFocus ? getComputedStyle(wrapperFocus) : null;
        const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? oc : (wc && wc.outlineStyle !== 'none' ? parse(wc.outlineColor) : null);
        if (!ring) return { sel: el.tagName.toLowerCase() + '.' + [...el.classList][0], none: true, vis };
        const rr = blend(ring, bg);
        const a = lum(rr), b = lum(bg);
        return { sel: el.tagName.toLowerCase() + '.' + [...el.classList][0], fg: h(rr), bg: h(bg), ratio: +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2), vis };
      }).catch(() => null);
      if (f) other.push({ kind: 'focus-ring', ...f, need: 3, pass: !f.none && f.ratio >= 3 });
    }
    for (const t of text) results.push({ page: path, width: w, kind: 'text', ...t });
    for (const o of other) results.push({ page: path, width: w, kind: o.kind, ...o });
    await ctx.close();
  }
}
await browser.close();

writeFileSync(join(outDir, 'contrast.json'), JSON.stringify(results, null, 1));
const fails = results.filter((r) => !r.pass);
const uniq = new Map();
for (const f of fails) {
  const k = [f.kind, f.sel, f.text || '', f.fg, f.bg].join('|');
  if (!uniq.has(k)) uniq.set(k, { ...f, where: new Set() });
  uniq.get(k).where.add(f.page + '@' + f.width);
}
const lines = [`Contrast audit ${new Date().toISOString()}`, `Checked ${results.length} items (${results.filter((r) => r.kind === 'text').length} text, ${results.filter((r) => r.kind === 'field-edge').length} field edges, ${results.filter((r) => r.kind === 'focus-ring').length} focus rings)`, `Failures: ${fails.length} (${uniq.size} unique)`, `Skipped (decorative code-typing illustration, see below): ${skipped.reduce((a, b) => a + b.skippedCode, 0)} text nodes across pages/widths`, ''];
for (const f of uniq.values()) lines.push(`FAIL ${f.kind} ${f.ratio ?? 'n/a'} (need ${f.need ?? 3}) ${f.fg || ''} on ${f.bg || ''} ${f.sel} "${f.text || f.note || ''}" ${f.bgImage ? '[bg-image ' + f.bgImage + ']' : ''} [${[...f.where].join(', ')}]`);
const imgs = results.filter((r) => r.bgImage && r.pass);
lines.push('', 'Justified exception: text inside <code> in the process cards is a decorative typing animation (characters fade in one by one under a fade overlay) and is excluded.', `Passing text over a background-image (colour-only check, review manually): ${new Set(imgs.map((r) => r.page + '@' + r.width + ' ' + r.sel)).size}`);
writeFileSync(join(outDir, 'contrast-summary.txt'), lines.join('\n') + '\n');
console.log(lines.slice(0, 80).join('\n'));
