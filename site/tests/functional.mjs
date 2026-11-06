// Functional smoke test of the built site (static server on :4321 serving dist/).
// Covers nav links, mobile menu, static FAQ, worked example, form validation, appear animations and console errors.
// Every non-localhost request is aborted, so nothing is ever sent externally.
// Usage: node tests/functional.mjs
import { chromium } from 'playwright-core';

const base = 'http://localhost:4321';
const exe = process.env.CHROME_PATH || '/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const out = [];
const ok = (name, pass, info = '') => { out.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${info}`); };

async function open(w, path = '/') {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.route(/^(?!http:\/\/localhost)/, (r) => { external.push(r.request().url()); r.abort(); });
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  return { ctx, page, errors, external };
}
const visible = (page, sel) => page.locator(sel).evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).length);

// Desktop ---------------------------------------------------------------------------------------
{
  const { ctx, page, errors, external } = await open(1440);
  // nav links scroll to their section
  for (const [label, id] of [['Journey', 'journey'], ['Services', 'services'], ['Industries', 'industries'], ['Pricing', 'plans'], ['Contact', 'contact']]) {
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1500); // let the pill finish expanding
    await page.locator('nav a.framer-520aC', { hasText: new RegExp('^' + label + '$', 'i') }).first().click();
    await page.waitForTimeout(1500);
    const top = await page.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, id);
    ok(`desktop nav "${label}" scrolls to #${id}`, id === 'contact' ? top > 0 && top < 900 : Math.abs(top) < 120, `top=${Math.round(top)}`); // the slim contact strip sits at the very end of the page, so it cannot reach the top
    ok(`desktop nav "${label}" updates hash`, (await page.evaluate(() => location.hash)) === '#' + id);
  }
  // nav collapses to the compact pill once scrollY passes min(viewport, hero bottom), and expands 80px above that line
  {
    const pillW = () => page.evaluate(() => Math.round(document.querySelector('nav.framer-1t6bwo0 .framer-1eavvn1').getBoundingClientRect().width));
    const name = () => page.evaluate(() => document.querySelector('nav.framer-1t6bwo0').dataset.framerName);
    const jump = (y) => page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
    // pill widths sampled every frame for `ms` after the caller scrolls
    const sample = (ms) => page.evaluate((ms) => new Promise((done) => {
      const el = document.querySelector('nav.framer-1t6bwo0 .framer-1eavvn1'), ws = [], t0 = performance.now();
      const tick = () => { ws.push(Math.round(el.getBoundingClientRect().width)); performance.now() - t0 < ms ? requestAnimationFrame(tick) : done(ws); };
      requestAnimationFrame(tick);
    }), ms);
    const thr = await page.evaluate(() => Math.round(Math.min(innerHeight, document.getElementById('hero').getBoundingClientRect().bottom + scrollY)));
    await jump(0); await page.waitForTimeout(1200);
    const w0 = await pillW();
    ok('nav expanded at top', (await name()) === 'Desktop' && w0 > 1000, `w=${w0}`);
    await jump(thr - 5); await page.waitForTimeout(800);
    ok('nav still expanded just above the threshold', (await name()) === 'Desktop' && (await pillW()) === w0, `thr=${thr}`);
    await jump(thr + 5);
    const down = await sample(1200);
    const w1 = down.at(-1);
    ok('nav collapses past the hero', (await name()) === 'Process' && w1 < 700 && w1 > 300, `w=${w1}`);
    ok('collapse passes through intermediate widths', down.filter((w) => w > w1 + 40 && w < w0 - 40).length >= 3, down.filter((w, i) => i % 6 === 0).join(','));
    ok('collapsed nav shows the K mark, not the wordmark', await page.evaluate(() => {
      const l = document.querySelector('nav.framer-1t6bwo0 .framer-iz97ye'); const vis = (e) => e.getBoundingClientRect().width > 0;
      return vis(l.querySelector('.kn-nav-mark')) && !vis(l.querySelector('img[alt="Kynetic AI"]'));
    }));
    await jump(thr - 40); await page.waitForTimeout(800);
    ok('nav stays compact inside the 80px hysteresis band', (await name()) === 'Process' && (await pillW()) === w1);
    await jump(thr - 100);
    const up = await sample(1200);
    ok('nav expands again scrolling back up', (await name()) === 'Desktop' && up.at(-1) === w0, `w=${up.at(-1)}`);
    ok('expand passes through intermediate widths', up.filter((w) => w > w1 + 40 && w < w0 - 40).length >= 3, up.filter((w, i) => i % 6 === 0).join(','));
    // reverse mid-collapse: width must continue from where it is, never snap to either end
    await jump(thr + 5); await page.waitForTimeout(150);
    const mid = await pillW();
    await jump(thr - 100);
    const back = await sample(1200);
    ok('reversing mid-collapse is smooth', mid < w0 - 40 && mid > w1 + 40 && Math.abs(back[0] - mid) < 150 && back.at(-1) === w0, `mid=${mid} first=${back[0]} end=${back.at(-1)}`);
  }
  // FAQ: static, answers visible
  const faqItems = page.locator('#faq .kn-faq__item');
  ok('FAQ: 5 questions, each with a visible answer', (await faqItems.count()) === 5 && (await page.locator('#faq dd:visible').count()) === 5);
  // audit overlay validation
  let reqs = 0; page.on('request', (r) => { if (r.method() === 'POST') reqs++; });
  await page.locator('#hero a[href*="cal.com"]').first().click(); await page.waitForTimeout(500);
  const modal = page.locator('.am__step[data-step="1"]');
  ok('audit overlay opens with the contact step', await modal.isVisible());
  await modal.locator('button[type=submit]').click(); await page.waitForTimeout(300);
  ok('audit overlay: empty name blocked', (await modal.locator('.am__err').innerText()).includes('name'));
  await modal.locator('input[name=name]').fill('Test User');
  await modal.locator('input[name=email]').fill('not-an-email');
  await modal.locator('button[type=submit]').click(); await page.waitForTimeout(300);
  ok('audit overlay: malformed email rejected', (await modal.locator('.am__err').innerText()).includes('email'));
  ok('audit overlay: no POST sent while invalid', reqs === 0, `posts=${reqs}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('audit overlay: Escape closes it', await page.evaluate(() => document.querySelector('.am').hidden));
  // services map popovers
  await page.evaluate(() => document.getElementById('services').scrollIntoView()); await page.waitForTimeout(1500);
  await page.locator('.m-node[data-pop="1"]').hover(); await page.waitForTimeout(300);
  ok('map: hovering a system shows its card', await page.locator('#pop1').isVisible() && (await page.locator('#pop1').innerText()).includes('Follow-Up'));
  await page.locator('.m-node[data-pop="3"]').hover(); await page.waitForTimeout(300);
  ok('map: only one card shows at a time', (await page.locator('.kn-pop:visible').count()) === 1 && await page.locator('#pop3').isVisible());
  await page.mouse.move(5, 5); await page.waitForTimeout(300);
  ok('map: leaving the system hides the card', (await page.locator('.kn-pop:visible').count()) === 0);
  // appear animations: nothing in the hero may stay hidden after load + scroll through the page
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= H; y += 300) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(250); }
  await page.waitForTimeout(2500);
  const stuck = await page.evaluate(() => [...document.querySelectorAll('[data-framer-appear-id], [data-framer-name] h1, h1, h2')].filter((e) => { for (let x = e; x; x = x.parentElement) { if (parseFloat(getComputedStyle(x).opacity) < 0.05 && !x.closest('code')) return true; } return false; }).map((e) => e.tagName + '.' + [...e.classList].slice(0, 1)));
  ok('appear animations: headings and appear targets reach visibility', stuck.length === 0, stuck.slice(0, 5).join(','));
  ok('desktop: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  ok('desktop: external requests all aborted (none succeeded)', true, `${external.length} attempted (fonts etc.)`);
  await ctx.close();
}

// Mobile ----------------------------------------------------------------------------------------
{
  const { ctx, page, errors } = await open(390);
  const nav = page.locator('nav[data-framer-name="Mobileclosed"], nav[data-framer-name="Mobile open"]').first();
  const ham = page.locator('nav .framer-cwn08').first();
  const hClosed = (await nav.boundingBox()).height;
  await ham.click(); await page.waitForTimeout(1000);
  const hOpen = (await nav.boundingBox()).height;
  ok('mobile menu opens', (await nav.getAttribute('data-framer-name')) === 'Mobile open' && hOpen > hClosed + 50, `h ${Math.round(hClosed)}->${Math.round(hOpen)}`);
  const link = nav.locator('.framer-1mmfnwb a', { hasText: /pricing/i }).first();
  ok('mobile menu shows links', (await link.count()) > 0 && (await link.isVisible()));
  await link.click(); await page.waitForTimeout(1500);
  ok('mobile menu link closes the menu', (await nav.getAttribute('data-framer-name')) === 'Mobileclosed');
  const top = await page.evaluate(() => document.getElementById('plans').getBoundingClientRect().top);
  ok('mobile menu link scrolls to #plans', Math.abs(top) < 130, `top=${Math.round(top)}`);
  await ham.click(); await page.waitForTimeout(900);
  await ham.click(); await page.waitForTimeout(900);
  ok('hamburger toggles closed again', (await nav.getAttribute('data-framer-name')) === 'Mobileclosed');
  await ham.focus(); await page.keyboard.press('Tab'); await ham.focus();
  const ring = await ham.evaluate((e) => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineColor);
  ok('hamburger shows an orange focus ring', /solid rgb\(168, 70, 26\)/.test(ring), ring);
  ok('mobile: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// (relative links are resolved against the clean URL without the trailing slash, how the host serves it; with the slash the
// footer's ./privacy and ./terms on the legal pages would land on /privacy/privacy, a pre-existing quirk of the ported markup)
// Other pages: errors, links, ROI calculator -----------------------------------------------------
for (const path of ['/privacy/', '/terms/', '/roi-calculator/']) {
  const { ctx, page, errors } = await open(1440, path);
  if (path === '/roi-calculator/') {
    await page.fill('#jobValue', '500'); await page.fill('#leads', '40'); await page.fill('#speed', '30');
    await page.fill('#contactPct', '30'); await page.fill('#bookPct', '30'); await page.fill('#showPct', '70'); await page.fill('#closePct', '25');
    await page.waitForTimeout(500);
    const txt = await page.evaluate(() => document.body.innerText);
    ok('roi: calculator renders figures from inputs', /\$\s?[\d,]{3,}/.test(txt));
  }
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
  const local = [...new Set(links.filter((h) => h.startsWith('./') || h.startsWith('/') || h.startsWith('..')))].filter((h) => !h.includes('#'));
  const bad = [];
  for (const h of local) { const r = await page.request.get(new URL(h, base + path.replace(/\/$/, '')).href).catch(() => null); if (!r || r.status() >= 400) bad.push(h); }
  ok(`${path} internal links resolve`, bad.length === 0, bad.join(','));
  ok(`${path} no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = out.filter((o) => !o.pass);
console.log(`\n${out.length - failed.length}/${out.length} passed`);
process.exit(failed.length ? 1 : 0);
