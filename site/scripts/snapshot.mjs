// Snapshot the published kyneticai.com pages into editable Astro source.
// Reads the server-rendered HTML + CSS (layout, type, colour and initial animation states are
// all in there), drops the Framer runtime, self-hosts every asset, and writes:
//   src/snapshot/<page>.head.html   <head> tags (meta, icons)
//   src/snapshot/<page>.body.html   page markup
//   src/snapshot/<page>.css         page CSS (inlined by the layout)
//   public/assets/*                 images and fonts
// Usage: node scripts/snapshot.mjs [baseUrl]   (default https://kyneticai.com)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { basename, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || 'https://kyneticai.com';
const pages = { index: '/', privacy: '/privacy', terms: '/terms' };

const curl = (url, out) =>
  execFileSync('curl', ['-sS', '-f', '-m', '60', '-L', '-o', out, url], { stdio: 'inherit' });
const fetchText = (url) => {
  const tmp = join(root, '.tmp-fetch');
  curl(url, tmp);
  return readFileSync(tmp, 'utf8');
};

mkdirSync(join(root, 'src/snapshot'), { recursive: true });
mkdirSync(join(root, 'public/assets'), { recursive: true });

const assetMap = new Map(); // remote url (no query) -> local path
const URL_RE = /https:\/\/framerusercontent\.com\/[^"'\s)\\<>]+/g;

function localize(url) {
  const clean = url.split('?')[0].replace(/&amp;/g, '&');
  if (assetMap.has(clean)) return assetMap.get(clean);
  const ext = extname(clean) || '.bin';
  const hash = createHash('sha1').update(clean).digest('hex').slice(0, 8);
  const name = `${basename(clean, ext).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24)}-${hash}${ext}`;
  const dest = join(root, 'public/assets', name);
  if (!existsSync(dest)) curl(clean, dest);
  const local = `/assets/${name}`;
  assetMap.set(clean, local);
  return local;
}

const rewrite = (text) => text.replace(URL_RE, (u) => localize(u));

// Icons (Phosphor/Feather) are drawn client-side by Framer, so the server HTML has empty holders.
// Read the finished <svg> markup from the live, hydrated page at each breakpoint.
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
async function liveIcons(path) {
  const found = {};
  for (const width of [1440, 900, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const got = await page.evaluate(() => {
      const o = {};
      document.querySelectorAll('div[class*="-container"]').forEach((el) => {
        const cls = [...el.classList].find((c) => /^framer-[a-z0-9]+-container$/.test(c));
        const h = el.innerHTML;
        if (cls && h.includes('<svg') && !h.includes('<canvas') && h.length < 6000 && !el.querySelector('p, img')) o[cls] = h;
      });
      return o;
    });
    Object.assign(found, got);
    await ctx.close();
  }
  return found;
}

for (const [name, path] of Object.entries(pages)) {
  const html = fetchText(base + path);
  const icons = await liveIcons(path);
  const $ = cheerio.load(html, { decodeEntities: false });

  // --- strip the runtime and Framer branding
  $('script, link[rel="modulepreload"], link[rel="preconnect"]').remove();
  $('meta[name="generator"], meta[name="framer-search-index"], meta[name="framer-html-plugin"]').remove();
  $('meta[name^="framer"]').remove();
  $('*').contents().each((_, n) => { if (n.type === 'comment' && /Framer|Published/.test(n.data)) $(n).remove(); });

  // --- Benefits section was deleted from the site: drop its nav and footer links (requested 2026-10-21)
  $('a[data-framer-name="Benefits"]').remove();
  $('div[data-framer-name="Links"] a').filter((_, a) => $(a).text().trim() === 'Benefits').each((_, a) => {
    const wrap = $(a).closest('div[data-framer-component-type="RichTextContainer"]');
    (wrap.length ? wrap : $(a)).remove();
  });
  $('[class$="-container"]').filter((_, e) => $(e).children().length <= 1 && $(e).text().trim() === 'Benefits').remove();

  // --- inject icon svgs into the empty holders
  let injected = 0;
  for (const [cls, h] of Object.entries(icons)) {
    $(`div.${cls}`).each((_, el) => {
      if ($(el).find('svg').length === 0) { $(el).html(h); injected++; }
    });
  }
  console.log(`${name}: injected ${injected} icons`);

  // --- styles: collect, localise assets
  const css = $('style').map((_, s) => $(s).html()).get().join('\n');
  $('style').remove();

  // --- main markup
  const main = $('#main');
  main.removeAttr('data-framer-hydrate-v2');
  const svgTemplates = $('#svg-templates');
  const bodyHtml = $.html(main) + (svgTemplates.length ? $.html(svgTemplates) : '');

  // --- head tags (title/meta/icons) without scripts/styles
  const headHtml = $('head').html().trim();

  writeFileSync(join(root, `src/snapshot/${name}.css`), rewrite(css));
  writeFileSync(join(root, `src/snapshot/${name}.body.html`), rewrite(bodyHtml));
  writeFileSync(join(root, `src/snapshot/${name}.head.html`), rewrite(headHtml));
  console.log(`${name}: css ${css.length}, body ${bodyHtml.length}, assets so far ${assetMap.size}`);
}
await browser.close();
console.log('assets:', [...assetMap.values()].join('\n'));
