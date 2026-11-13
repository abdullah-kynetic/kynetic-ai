// Visual diff: live Framer site vs this build, full-page, at three widths.
// Usage: node tests/visual/diff.mjs [--live https://kyneticai.com] [--page /] [--only desktop]
import { chromium } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = join(root, 'dist');
const out = join(root, 'tests/visual/out');
mkdirSync(out, { recursive: true });
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const live = arg('live', 'https://kyneticai.com');
const pagePath = arg('page', '/');
const only = arg('only', '');
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = join(dist, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
}).listen(4399);

const sizes = [['desktop', 1440, 900], ['tablet', 900, 1100], ['mobile', 390, 844]].filter(([n]) => !only || n === only);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

async function shoot(url, w, h, file) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(3500);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= H; y += Math.floor(h / 2)) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(900); }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return H;
}

const summary = [];
for (const [name, w, h] of sizes) {
  const a = join(out, `${name}_live.png`), b = join(out, `${name}_local.png`);
  const [Ha, Hb] = [await shoot(live + pagePath, w, h, a), await shoot(`http://localhost:4399${pagePath}`, w, h, b)];
  const A = PNG.sync.read((await import('node:fs')).readFileSync(a));
  const B = PNG.sync.read((await import('node:fs')).readFileSync(b));
  const W = Math.min(A.width, B.width), Hh = Math.min(A.height, B.height);
  const crop = (img) => { const o = new PNG({ width: W, height: Hh }); PNG.bitblt(img, o, 0, 0, W, Hh, 0, 0); return o; };
  const [ca, cb] = [crop(A), crop(B)];
  const diff = new PNG({ width: W, height: Hh });
  const n = pixelmatch(ca.data, cb.data, diff.data, W, Hh, { threshold: 0.1 });
  writeFileSync(join(out, `${name}_diff.png`), PNG.sync.write(diff));
  // 400px bands
  const bands = [];
  for (let y = 0; y < Hh; y += 400) {
    const bh = Math.min(400, Hh - y);
    const sa = new PNG({ width: W, height: bh }), sb = new PNG({ width: W, height: bh }), sd = new PNG({ width: W, height: bh });
    PNG.bitblt(ca, sa, 0, y, W, bh, 0, 0); PNG.bitblt(cb, sb, 0, y, W, bh, 0, 0);
    bands.push(((pixelmatch(sa.data, sb.data, sd.data, W, bh, { threshold: 0.1 }) / (W * bh)) * 100).toFixed(1));
  }
  summary.push({ name, liveHeight: Ha, localHeight: Hb, diffPct: ((n / (W * Hh)) * 100).toFixed(2), bands400: bands.join(' ') });
}
console.log(JSON.stringify(summary, null, 1));
await browser.close();
server.close();
