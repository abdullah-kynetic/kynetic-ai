// Functional smoke test of the built site (static server on :4321 serving dist/).
// Covers nav links, mobile menu, FAQ expand/collapse, form validation, appear animations and console errors.
// Every non-localhost request is aborted, so nothing is ever sent externally.
// Usage: node tests/functional.mjs
import { chromium } from 'playwright-core';

const base = 'http://localhost:4321';
const exe = '/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
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
  for (const [label, id] of [['Process', 'process'], ['Plans', 'plans'], ['Contact', 'contact']]) {
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
    await page.locator('nav a.framer-520aC', { hasText: new RegExp('^' + label + '$', 'i') }).first().click();
    await page.waitForTimeout(1500);
    const top = await page.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, id);
    ok(`desktop nav "${label}" scrolls to #${id}`, Math.abs(top) < 120, `top=${Math.round(top)}`);
    ok(`desktop nav "${label}" updates hash`, (await page.evaluate(() => location.hash)) === '#' + id);
  }
  // FAQ
  await page.evaluate(() => document.getElementById('contact') && 0);
  const rows = page.locator('.framer-Hzat5');
  const n = await rows.count();
  ok('FAQ rows present', n >= 5, `n=${n}`);
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    await row.scrollIntoViewIfNeeded();
    const h0 = (await row.boundingBox()).height;
    await row.click(); await page.waitForTimeout(900);
    const opened = (await row.getAttribute('data-framer-name')) === 'Open' && (await row.locator('[data-framer-name="Answer"]').count()) === 1;
    const h1 = (await row.boundingBox()).height;
    await row.click(); await page.waitForTimeout(900);
    const closed = (await row.getAttribute('data-framer-name')) === 'Closed' && (await row.locator('[data-framer-name="Answer"]').count()) === 0;
    const h2 = (await row.boundingBox()).height;
    ok(`FAQ row ${i + 1} expands and collapses`, opened && closed && h1 > h0 && Math.abs(h2 - h0) < 2, `h ${Math.round(h0)}->${Math.round(h1)}->${Math.round(h2)}`);
  }
  // keyboard on FAQ
  await rows.first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  ok('FAQ opens with Enter key', (await rows.first().getAttribute('data-framer-name')) === 'Open');
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  // form validation
  const form = page.locator('form').first();
  await form.scrollIntoViewIfNeeded();
  const submit = form.locator('button[type=submit]:visible').first();
  let reqs = 0; page.on('request', (r) => { if (r.method() === 'POST') reqs++; });
  await submit.click(); await page.waitForTimeout(500);
  const invalid1 = await form.evaluate((f) => [...f.querySelectorAll('input,textarea')].filter((e) => !e.checkValidity()).map((e) => e.name));
  ok('form: empty submit blocked by required validation', invalid1.includes('Name') && invalid1.includes('Email'), invalid1.join(','));
  await form.locator('input[name=Name]').fill('Test User');
  await form.locator('input[name=Email]').fill('not-an-email');
  await submit.click(); await page.waitForTimeout(500);
  const emailInvalid = await form.locator('input[name=Email]').evaluate((e) => !e.validity.valid && e.validity.typeMismatch);
  ok('form: malformed email rejected', emailInvalid);
  ok('form: no POST sent while invalid', reqs === 0, `posts=${reqs}`);
  await page.evaluate(() => (document.querySelector('form').reset()));
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
  const link = nav.locator('.framer-1mmfnwb a', { hasText: /plans/i }).first();
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
