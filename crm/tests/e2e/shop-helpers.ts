import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const calm =
  '#nprogress { display: none !important; } *, *::before, *::after { transition: none !important; animation: none !important; }';

/** Committed screenshots for the step (light theme, desktop and phone). */
export const shotsDir = (step: string) => {
  const dir = join(process.cwd(), '..', 'docs', 'phases', 'aa-shop', 'shots', step);
  mkdirSync(dir, { recursive: true });
  return dir;
};
/** Dark-theme and extra shots are for the session's own review and are not committed. */
export const scratchDir = (step: string) => {
  const dir = join(process.env.SHOT_SCRATCH ?? '/tmp/aa-shop-shots', step);
  mkdirSync(dir, { recursive: true });
  return dir;
};

export async function setTheme(page: Page, mode: 'light' | 'dark') {
  await page.evaluate((m) => localStorage.setItem('theme', m), mode);
  await page.reload();
  await page.waitForFunction(
    (dark) => document.documentElement.classList.contains('dark') === dark,
    mode === 'dark'
  );
  await page.addStyleTag({ content: calm });
}

export type ShopCheck = { route: string; problems: string[] };

/**
 * Loads a shop page at 1440 and 390 px in light and dark. Returns every problem found: HTTP error,
 * sideways scroll, a control under 44 px that is not inline text, an accessibility violation.
 * Saves light screenshots to `docs/phases/aa-shop/shots/<step>/` and dark ones to the scratch folder.
 */
export async function checkShopPage(page: Page, route: string, step: string): Promise<ShopCheck> {
  const problems: string[] = [];
  const name = route.replace(/^\/dashboard\/shop\/?/, '').replace(/[^a-z0-9]+/gi, '-') || 'index';
  const response = await page.goto(route);
  if (!response || response.status() >= 400) {
    return { route, problems: [`${route}: HTTP ${response?.status()}`] };
  }
  await page.waitForLoadState('networkidle');
  for (const mode of ['light', 'dark'] as const) {
    await setTheme(page, mode);
    for (const [label, size] of [
      ['1440', { width: 1440, height: 1000 }],
      ['390', { width: 390, height: 844 }]
    ] as const) {
      await page.setViewportSize(size);
      await page.mouse.move(0, 0);
      const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
      for (const v of results.violations)
        problems.push(
          `${mode}/${label} ${route}: ${v.id} (${v.impact}) ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(','))
            .join(' | ')}`
        );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (overflow > 0)
        problems.push(`${mode}/${label} ${route}: sideways scroll of ${overflow}px`);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(
          'main button, main [role=button], main a[href], main input, main select, main textarea'
        )) {
          const style = getComputedStyle(el);
          if (style.display === 'inline' && el.tagName === 'A') continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          // Native inputs a custom control hides at 1 px are not the thing a person taps.
          if (r.width <= 2 && r.height <= 2) continue;
          if (r.height < 43.5 && r.width < 43.5)
            out.push(
              `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`
            );
        }
        return out;
      });
      for (const s of small) problems.push(`${mode}/${label} ${route}: tap target too small ${s}`);
      const dir = mode === 'light' ? shotsDir(step) : scratchDir(step);
      await page.screenshot({ path: join(dir, `${name}-${label}-${mode}.png`), fullPage: true });
    }
  }
  return { route, problems };
}
