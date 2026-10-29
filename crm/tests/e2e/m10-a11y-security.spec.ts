import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

async function scanMatrix(page: import('@playwright/test').Page, route: string) {
  await page.goto(route);
  const violations: string[] = [];
  for (const mode of ['light', 'dark'] as const)
    for (const viewport of ['desktop', 'mobile'] as const) {
      await page.addStyleTag({
        content:
          '*, *::before, *::after { transition: none !important; animation: none !important; }'
      });
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (isDark !== (mode === 'dark')) {
        const themeToggle = page.getByRole('button', { name: 'Toggle theme' });
        if (await themeToggle.count()) {
          await themeToggle.click();
        } else {
          await page.evaluate((theme) => localStorage.setItem('theme', theme), mode);
          await page.reload();
          await page.addStyleTag({
            content:
              '*, *::before, *::after { transition: none !important; animation: none !important; }'
          });
        }
        await page.waitForFunction(
          (dark) => document.documentElement.classList.contains('dark') === dark,
          mode === 'dark'
        );
        await page.waitForTimeout(250);
      }
      await page.setViewportSize(
        viewport === 'desktop' ? { width: 1440, height: 1000 } : { width: 390, height: 844 }
      );
      const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
      violations.push(
        ...(await Promise.all(
          results.violations.map(
            async (v) =>
              `${mode}/${viewport} ${route}: ${v.id} ${await Promise.all(
                v.nodes.map(async (n) => {
                  const detail = await page.evaluate((selector) => {
                    try {
                      const el = document.querySelector(selector);
                      if (!el) return 'element missing';
                      const style = getComputedStyle(el);
                      return `${el.tagName.toLowerCase()} text=${JSON.stringify(el.textContent?.trim().slice(0, 60))} class=${el.getAttribute('class')} disabled=${el.getAttribute('disabled')} aria-disabled=${el.getAttribute('aria-disabled')} fg=${style.color} bg=${style.backgroundColor} opacity=${style.opacity}`;
                    } catch {
                      return 'selector unavailable';
                    }
                  }, n.target.join(' '));
                  return `${n.target.join(',')} ${detail} ${n.failureSummary ?? ''}`;
                })
              )}`
          )
        ))
      );
    }
  return violations;
}

test('M10-04 WCAG 2.2 A/AA automated scan on owner routes across themes and viewports', async ({
  authenticatedPage
}) => {
  test.setTimeout(300_000);
  const violations: string[] = [];
  const routes = [
    '/dashboard',
    '/dashboard/contacts',
    '/dashboard/appointments',
    '/dashboard/pipeline',
    '/dashboard/calls',
    '/dashboard/tasks',
    '/dashboard/notifications',
    '/dashboard/reports',
    '/dashboard/settings/business',
    '/dashboard/settings/team',
    '/dashboard/settings/branding',
    '/dashboard/documents'
  ];
  for (const route of routes) violations.push(...(await scanMatrix(authenticatedPage, route)));
  await authenticatedPage.setViewportSize({ width: 1440, height: 1000 });
  await authenticatedPage.goto('/dashboard/contacts');
  const contactHref = await authenticatedPage
    .locator('a[href^="/dashboard/contacts/"]')
    .first()
    .getAttribute('href');
  expect(contactHref, 'synthetic contact detail link').toBeTruthy();
  violations.push(...(await scanMatrix(authenticatedPage, contactHref!)));
  await authenticatedPage.goto('/dashboard/calls');
  const callHref = '/dashboard/calls/cccccccc-0000-4000-8000-000000000063';
  violations.push(...(await scanMatrix(authenticatedPage, callHref)));
  await authenticatedPage.goto('/dashboard/reports');
  const reportHref = await authenticatedPage
    .locator('a[href^="/dashboard/reports/"]')
    .first()
    .getAttribute('href');
  expect(reportHref, 'synthetic report detail link').toBeTruthy();
  violations.push(...(await scanMatrix(authenticatedPage, reportHref!)));
  expect(violations, violations.join('\n')).toEqual([]);
});

test('M10-04 WCAG 2.2 A/AA automated scan on admin routes across themes and viewports', async ({
  adminPage
}) => {
  test.setTimeout(300_000);
  const violations: string[] = [];
  const routes = [
    '/admin',
    '/admin/clients/11111111-1111-4111-8111-111111111111/alex',
    '/admin/clients/11111111-1111-4111-8111-111111111111/documents',
    '/admin/users',
    '/admin/audit',
    '/admin/operations',
    '/admin/backups'
  ];
  for (const route of routes) violations.push(...(await scanMatrix(adminPage, route)));
  expect(violations, violations.join('\n')).toEqual([]);
});

test('M10-04 WCAG 2.2 A/AA automated scan on sign-in and accept-terms', async ({
  page,
  termsPage
}) => {
  const violations: string[] = [];
  violations.push(...(await scanMatrix(page, '/sign-in')));
  violations.push(...(await scanMatrix(termsPage, '/accept-terms')));
  expect(violations, violations.join('\n')).toEqual([]);
});

test('F-87 provider configuration and secrets are absent from browser responses', async ({
  authenticatedPage,
  adminPage
}) => {
  const responses: string[] = [];
  const capture = (response: {
    url(): string;
    headers(): Record<string, string>;
    status(): number;
  }) => {
    if (response.url().includes('/_next/') || response.url().includes('/api/')) {
      responses.push(
        `${response.url()} ${response.status()} ${JSON.stringify(response.headers())}`
      );
    }
  };
  authenticatedPage.on('response', capture);
  adminPage.on('response', capture);
  await authenticatedPage.goto('/dashboard/settings/alex');
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/alex');
  await adminPage.goto('/admin/operations');
  await expect(adminPage.getByRole('heading', { name: 'Integration health' })).toBeVisible();
  const browserData = responses.join('\n');
  expect(browserData).not.toMatch(/(?:sk|pk|key|secret|token)[_-][A-Za-z0-9_-]{12,}/i);
  expect(browserData).not.toContain('APP_ENCRYPTION_KEY');
  expect(browserData).not.toContain('BETTER_AUTH_SECRET');
});

test('M10-04 keyboard navigation reaches primary controls on daily-use pages', async ({
  authenticatedPage
}) => {
  for (const route of ['/dashboard/contacts', '/dashboard/appointments', '/dashboard/tasks']) {
    await authenticatedPage.goto(route);
    await authenticatedPage.keyboard.press('Tab');
    const first = await authenticatedPage.evaluate(() => ({
      text: document.activeElement?.textContent?.trim() ?? '',
      tag: document.activeElement?.tagName.toLowerCase(),
      outline: getComputedStyle(document.activeElement!).outlineStyle
    }));
    expect(first.tag, `${route} first tab stop`).not.toBe('body');
    expect(first.outline, `${route} focus indicator`).not.toBe('none');
  }
});
