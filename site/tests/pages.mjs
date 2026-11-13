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
    ok(`${tag} home: hero is "Your AI growth partner"`, (await page.locator('h1').first().innerText()).trim() === 'Your AI growth partner');
    ok(`${tag} home: journey has 4 steps`, (await page.locator('#journey .kn-step').count()) === 4);
    ok(`${tag} home: services has 6 cards`, (await page.locator('#services .kn-card').count()) === 6);
    ok(`${tag} home: only Alex is tagged Live`, (await page.locator('#services .kn-tag--live').count()) === 1);
    ok(`${tag} home: industries lists Remodelers (link) and two coming soon`, (await page.locator('#industries a[href="/remodelers"]').count()) === 1 && (await page.locator('#industries .kn-card--soon').count()) === 2);
    ok(`${tag} home: pricing is "Start with Alex"`, (await page.locator('#plans .kn-pricing__title').innerText()).trim() === 'Start with Alex');
    ok(`${tag} home: no "consulting" as identity and no niche names`, !/consulting|consultancy/.test(text) && !/remodeler|solar|foundation/.test(await page.locator('#journey, #services, #plans, #hero').evaluateAll((els) => els.map((e) => e.innerText).join(' ').toLowerCase())));
    ok(`${tag} home: no horizontal scroll`, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    ok(`${tag} home: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // Remodelers
  {
    const { ctx, page, errors } = await open('/remodelers', width);
    ok(`${tag} remodelers: headline`, (await page.locator('h1').innerText()).trim() === 'Done-for-you AI System for remodelers');
    ok(`${tag} remodelers: noindex while draft`, (await page.locator('meta[name="robots"]').getAttribute('content')) === 'noindex, nofollow');
    ok(`${tag} remodelers: only Alex is Live, four add-ons`, (await page.locator('.np-tag--live').count()) === 1 && (await page.locator('.np-addons li').count()) === 4);
    ok(`${tag} remodelers: animated Alex card present`, (await page.locator('.np-demo__steps li').count()) === 4);
    const cta = await page.locator('a.np-btn--primary').evaluateAll((as) => as.map((a) => a.href));
    ok(`${tag} remodelers: every CTA goes to the Cal booking`, cta.length >= 3 && cta.every((h) => h.startsWith('https://cal.com/abdullah-kyneticai/')));
    ok(`${tag} remodelers: TODO markers visible (video, add-ons, guarantee, proof)`, (await page.locator('.np-todo').count()) === 4);
    ok(`${tag} remodelers: no horizontal scroll`, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    ok(`${tag} remodelers: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
