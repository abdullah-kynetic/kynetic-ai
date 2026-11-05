// Content checks for the homepage positioning and the niche pages, run against a local preview (npm run build && npm run preview).
// Usage: CHROME_PATH=/path/to/chrome node tests/pages.mjs   (BASE_URL defaults to http://localhost:4321)
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://localhost:4321';
const exe = process.env.CHROME_PATH || '/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let failed = 0;
const ok = (name, pass, info = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${info}`); };

async function open(path, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}

for (const width of [1440, 390]) {
  const tag = width > 800 ? 'desktop' : 'mobile';
  // Homepage
  {
    const { ctx, page, errors } = await open('/', width);
    const text = (await page.locator('body').innerText()).toLowerCase();
    ok(`${tag} home: pill is "AI growth partner" and is not an H1`, (await page.locator('#hero p', { hasText: /^AI growth partner$/ }).count()) === 1);
    ok(`${tag} home: one broad H1`, (await page.locator('h1').count()) === 1 && (await page.locator('h1').innerText()).trim() === 'More Revenue, Less Busywork, and a Business That Runs Smarter.');
    ok(`${tag} home: hero CTA and microcopy`, (await page.locator('#hero a', { hasText: 'Book your free AI audit' }).count()) >= 1 && /A few short questions, then pick a time\. The call is free\./.test(await page.locator('#hero').innerText()));
    if (tag === 'desktop') { const lines = await page.locator('h1').evaluate((h) => Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight))); ok('desktop home: H1 fits in about 3 lines', lines >= 2 && lines <= 4, `lines=${lines}`); }
    ok(`${tag} home: journey has 4 steps`, (await page.locator('#journey .kn-step').count()) === 4);
    ok(`${tag} home: services is the map with six system cards, no card grid, no Live or Built-after-audit labels`, (await page.locator('#services .kn-map .m-node').count()) === 6 && (await page.locator('#services .kn-pop').count()) === 6 && (await page.locator('#services .kn-cards, #services .kn-onsite').count()) === 0 && !/\blive\b|built after your audit/i.test(await page.locator('#services').innerText()));
    ok(`${tag} home: industries has Remodelers (link) plus two coming-soon cards`, (await page.locator('#industries a[href="/remodelers"]').count()) === 1 && (await page.locator('#industries .kn-card').count()) === 3 && (await page.locator('#industries .kn-card--soon').count()) === 2);
    ok(`${tag} home: AI Transformation card mentions optional on-site days`, /2 to 3 days on-site/.test(await page.locator('#pop5').textContent()));
    ok(`${tag} home: pricing ladder has 4 steps, no calculator, no guarantee`, (await page.locator('#plans .kn-sec__eyebrow').textContent()).trim() === 'How pricing works' && (await page.locator('#plans .kn-step').count()) === 4 && (await page.locator('#plans [data-leak-calc], #plans .kn-pricing__guarantee').count()) === 0);
    ok(`${tag} home: no $10,000, no founding terms, no fixed add-on prices`, !/\$10,000|founding|\$3,000|\$2,500|\$1,500/i.test(await page.locator('#plans').innerText()));
    const body = (await page.locator('main, #main').first().innerText()).toLowerCase();
    const heroText = (await page.locator('#hero').innerText()).toLowerCase();
    ok(`${tag} home: hero has no industry, lead-speed or tool-first language`, !/remodel|contractor|home service|60 seconds|missed call|\balex\b|\bleads?\b|speed-to-lead|n8n|automation/.test(heroText));
    ok(`${tag} home: no contact form, audit button opens the overlay`, (await page.locator('form:not(.am__step)').count()) === 0 && (await page.locator('#contact [data-audit-open]').count()) === 1);
    ok(`${tag} home: no scarcity line`, !/few new clients a month/.test(text));
    ok(`${tag} home: no Nora card`, !/\bnora\b/.test(text));
    ok(`${tag} home: no "consulting" as identity`, !/consulting|consultancy/.test(text));
    ok(`${tag} home: no horizontal scroll`, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    ok(`${tag} home: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // Remodelers
  {
    const { ctx, page, errors } = await open('/remodelers', width);
    ok(`${tag} remodelers: label and outcome H1`, (await page.locator('.np-hero .np-badge').textContent()).trim() === 'Done-for-you AI System for remodelers' && (await page.locator('h1').count()) === 1 && (await page.locator('h1').innerText()).trim() === 'We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.');
    ok(`${tag} remodelers: noindex while draft`, (await page.locator('meta[name="robots"]').getAttribute('content')) === 'noindex, nofollow');
    ok(`${tag} remodelers: only Alex is Live, four add-ons with prices where mapped`, (await page.locator('.np-tag--live').count()) === 1 && (await page.locator('.np-addons li').count()) === 4 && (await page.locator('.np-addons__price', { hasText: '$2,500 + $500/mo' }).count()) === 1 && (await page.locator('.np-addons__price', { hasText: 'Scoped on your audit' }).count()) === 2);
    ok(`${tag} remodelers: animated Alex card present`, (await page.locator('.np-demo__steps li').count()) === 4);
    const cta = await page.locator('a.np-btn--primary').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    ok(`${tag} remodelers: every CTA goes to the qualifier, whose form posts to Cal`, cta.length >= 2 && cta.every((h) => h === '#book') && (await page.locator('form[data-qualifier]').getAttribute('action')).startsWith('https://cal.com/abdullah-kyneticai/'));
    ok(`${tag} remodelers: draft items are not in the DOM (todo, video, placeholders)`, (await page.locator('.np-pending, .np-video, .np-proof').count()) === 0);
    ok(`${tag} remodelers: guarantee shows the locked line and 4 terms, no 14-day wording`, (await page.locator('#guarantee .np-guarantee__wording').innerText()).trim() === 'We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.' && (await page.locator('#guarantee .np-guarantee__terms li').count()) === 4 && !/14 days|14-day/i.test(await page.locator('body').innerText()));
    ok(`${tag} remodelers: honest results line, no case cards`, (await page.locator('.np-honest').count()) === 1 && (await page.locator('.np-case').count()) === 0);
    ok(`${tag} remodelers: worked example present`, (await page.locator('[data-leak-calc]').count()) === 1);
    ok(`${tag} remodelers: no horizontal scroll`, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    ok(`${tag} remodelers: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}
// Built output scan: visible text and comments must not carry draft markers (form placeholder="" attributes are not text).
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
for (const f of ['dist/index.html', 'dist/remodelers/index.html']) {
  const $ = load(readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
  $('script, style').remove();
  const comments = [];
  $('*').contents().each((_, n) => { if (n.type === 'comment') comments.push(n.data); });
  const hay = ($('body').text() + ' ' + $('head title').text() + ' ' + $('meta[name=description]').attr('content') + ' ' + comments.join(' ')).toLowerCase();
  // "coming soon" and "page in progress" are intentional on the homepage industries cards only
  const words = ['todo', 'placeholder', '[draft', 'draft', 'goes here', 'client result', ...(f === 'dist/index.html' ? [] : ['coming soon', 'page in progress'])];
  const hits = words.filter((w) => hay.includes(w));
  ok(`${f}: no draft markers in text`, hits.length === 0, hits.join(','));
}
await browser.close();
process.exit(failed ? 1 : 0);
