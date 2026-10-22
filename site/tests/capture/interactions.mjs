// Compare interaction end states and timings. Usage: BASE=http://localhost:4398 node tests/capture/interactions.mjs
// (BASE defaults to the live site). Run against both and diff the output.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const base = process.env.BASE || 'https://kyneticai.com';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const out = {};
const open = async (w, h, mobile) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  return p;
};
const trace = (p, fn, ms = 1000) =>
  p.evaluate(([src, ms]) => new Promise((res) => {
    const read = eval(src); const t0 = performance.now(); const s = [];
    const f = () => { s.push([Math.round(performance.now() - t0), read()]); performance.now() - t0 < ms ? requestAnimationFrame(f) : res(s); };
    requestAnimationFrame(f);
  }), [fn, ms]);

// FAQ: heights over time after open, then close
{
  const p = await open(1440, 900, false);
  const rows = p.locator('.framer-Hzat5');
  await rows.first().scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
  const h = '(()=>{const r=document.querySelectorAll(".framer-Hzat5")[0];return Math.round(r.getBoundingClientRect().height*10)/10})';
  const names = () => p.evaluate(() => [...document.querySelectorAll('.framer-Hzat5')].map((r) => r.dataset.framerName[0] + Math.round(r.getBoundingClientRect().height)).join(','));
  const settle = async (fn) => { const t = trace(p, h, 900); await fn(); return (await t).filter((_, i) => i % 6 === 0).map((x) => x[1]); };
  out.faqOpen = await settle(() => rows.first().click());
  out.faqAfterOpen = await names();
  await rows.nth(2).click(); await p.waitForTimeout(900);
  out.faqTwoOpen = await names();
  out.faqClose = await settle(() => rows.first().click());
  out.faqAfterClose = await names();
  out.faqAnswer = await p.evaluate(() => { document.querySelectorAll('.framer-Hzat5')[2].querySelector('[data-framer-name=Answer] p')?.textContent.slice(0, 60); return document.querySelectorAll('.framer-Hzat5')[2].querySelector('[data-framer-name=Answer] p')?.textContent.slice(0, 60); });
  await p.close();
}
// nav: scroll-spy + chip colour
{
  const p = await open(1440, 900, false);
  const sel = () => p.evaluate(() => [...document.querySelectorAll('nav.framer-FbUpk a.framer-520aC')].filter((a) => a.getBoundingClientRect().width > 0).map((a) => getComputedStyle(a).backgroundColor === 'rgba(255, 255, 255, 0.1)' ? 'S' : '-').join(''));
  out.spy = {};
  for (const y of [0, 1000, 1020, 2000, 2920, 4000, 4550, 6000]) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(900); out.spy[y] = await sel(); }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
  await p.locator('nav.framer-FbUpk a.framer-520aC').nth(1).hover(); await p.waitForTimeout(900);
  out.chipHover = await sel();
  const y0 = await p.evaluate(() => scrollY);
  await p.locator('nav.framer-FbUpk a.framer-520aC').filter({ hasText: 'Plans' }).first().click(); await p.waitForTimeout(2200);
  out.anchor = { y: await p.evaluate(() => Math.round(scrollY)), hash: await p.evaluate(() => location.hash), from: y0 };
  await p.close();
}
// button hover end state
{
  const p = await open(1440, 900, false);
  const btn = p.locator('a.framer-yPywB').first();
  const read = () => btn.evaluate((a) => ({ bc: getComputedStyle(a).getPropertyValue('--border-color'), top: Math.round(a.querySelector('[data-framer-name="1st state"]').getBoundingClientRect().top - a.getBoundingClientRect().top) }));
  out.btnRest = await read();
  await btn.hover(); await p.waitForTimeout(1500);
  const r = await read(); r.bc = r.bc.replace(/(\d\.\d{1,2})\d*/, '$1');
  out.btnHover = r;
  await p.close();
}
// mobile menu
{
  const p = await open(390, 844, true);
  const navH = '(()=>{const n=[...document.querySelectorAll("nav.framer-FbUpk")].find(n=>n.getBoundingClientRect().width>0);return Math.round(n.getBoundingClientRect().height*10)/10})';
  out.menuClosed = await p.evaluate(eval(navH));
  const t = trace(p, navH, 900);
  await p.locator('.framer-cwn08').first().tap();
  out.menuOpen = (await t).filter((_, i) => i % 5 === 0).map((x) => x[1]);
  out.menuNames = await p.evaluate(() => [...document.querySelectorAll('nav.framer-FbUpk')].filter((n) => n.getBoundingClientRect().width > 0).map((n) => n.dataset.framerName).join());
  await p.locator('nav [data-framer-name="Plans"]').filter({ visible: true }).first().tap(); await p.waitForTimeout(2000);
  out.menuAfter = { h: await p.evaluate(eval(navH)), y: await p.evaluate(() => Math.round(scrollY)) };
  await p.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
