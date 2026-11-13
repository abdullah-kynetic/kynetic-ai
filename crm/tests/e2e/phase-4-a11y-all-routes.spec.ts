import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// P4-1: every client page, admin page and public page passes the WCAG 2.2 A/AA scan, in light and
// dark, on desktop and at 390 px. The earlier M10 and phase 1 specs scan deeper states (open panels,
// import steps); this one makes sure no route is left out.

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const T = '11111111-1111-4111-8111-111111111111';
const calm =
  '#nprogress { display: none !important; } *, *::before, *::after { transition: none !important; animation: none !important; }';

async function setTheme(page: Page, mode: 'light' | 'dark') {
  await page.evaluate((m) => localStorage.setItem('theme', m), mode);
  await page.reload();
  await page.waitForFunction(
    (dark) => document.documentElement.classList.contains('dark') === dark,
    mode === 'dark'
  );
  await page.addStyleTag({ content: calm });
}

async function scanRoute(page: Page, route: string, themes = true): Promise<string[]> {
  const found: string[] = [];
  const response = await page.goto(route);
  if (!response || response.status() >= 500) return [`${route}: HTTP ${response?.status()}`];
  await page.waitForLoadState('networkidle');
  for (const mode of themes ? (['light', 'dark'] as const) : (['light'] as const)) {
    await setTheme(page, mode);
    for (const [name, size] of [
      ['desktop', { width: 1440, height: 1000 }],
      ['390px', { width: 390, height: 844 }]
    ] as const) {
      await page.setViewportSize(size);
      await page.mouse.move(0, 0);
      const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
      for (const v of results.violations)
        found.push(
          `${mode}/${name} ${route}: ${v.id} (${v.impact}) ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(','))
            .join(' | ')}`
        );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (name === '390px' && overflow > 0) found.push(`${mode}/${name} ${route}: sideways scroll`);
    }
  }
  return found;
}

async function firstHref(page: Page, listRoute: string, prefix: string): Promise<string | null> {
  await page.goto(listRoute);
  await page.waitForLoadState('networkidle');
  const hrefs = await page
    .locator(`a[href^="${prefix}"]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  return hrefs.find((h) => h !== prefix && !h.endsWith('/new')) ?? null;
}

test('P4-1 every client page passes the scan', async ({ authenticatedPage: page }) => {
  test.setTimeout(900_000);
  const routes = [
    '/dashboard',
    '/dashboard/appointments',
    '/dashboard/calls',
    '/dashboard/companies',
    '/dashboard/companies/new',
    '/dashboard/contacts',
    '/dashboard/documents',
    '/dashboard/import',
    '/dashboard/messages',
    '/dashboard/notifications',
    '/dashboard/pipeline',
    '/dashboard/presence',
    '/dashboard/referrals',
    '/dashboard/reports',
    '/dashboard/reviews',
    '/dashboard/settings',
    '/dashboard/settings/alex',
    '/dashboard/settings/automations',
    '/dashboard/settings/branding',
    '/dashboard/settings/business',
    '/dashboard/settings/custom-fields',
    '/dashboard/settings/notifications',
    '/dashboard/settings/pipeline',
    '/dashboard/settings/tags',
    '/dashboard/settings/team',
    '/dashboard/support',
    '/dashboard/systems',
    '/dashboard/tasks',
    '/dashboard/usage'
  ];
  const violations: string[] = [];
  for (const route of routes) violations.push(...(await scanRoute(page, route)));
  for (const [list, prefix] of [
    ['/dashboard/companies', '/dashboard/companies/'],
    ['/dashboard/support', '/dashboard/support/']
  ] as const) {
    const href = await firstHref(page, list, prefix);
    if (href) violations.push(...(await scanRoute(page, href)));
  }
  expect(violations, violations.join('\n')).toEqual([]);
});

test('P4-1 every admin page passes the scan', async ({ adminPage: page }) => {
  test.setTimeout(1_200_000);
  const routes = [
    '/admin',
    '/admin/agency',
    '/admin/agency/billing',
    '/admin/agency/campaigns',
    '/admin/agency/compose',
    '/admin/agency/contracts',
    '/admin/agency/dialer',
    '/admin/agency/finance',
    '/admin/agency/inbox',
    '/admin/agency/ops',
    '/admin/agency/proposals',
    '/admin/audit',
    '/admin/backups',
    '/admin/clients',
    '/admin/clients/new',
    `/admin/clients/${T}`,
    `/admin/clients/${T}/alex`,
    `/admin/clients/${T}/billing`,
    `/admin/clients/${T}/checklist`,
    `/admin/clients/${T}/documents`,
    `/admin/clients/${T}/imports`,
    `/admin/clients/${T}/modules`,
    `/admin/clients/${T}/offboard`,
    `/admin/clients/${T}/presence`,
    `/admin/clients/${T}/reports`,
    `/admin/clients/${T}/service-tokens`,
    `/admin/clients/${T}/systems`,
    `/admin/clients/${T}/webhooks`,
    '/admin/operations',
    '/admin/support',
    '/admin/system-requests',
    '/admin/templates',
    '/admin/usage',
    '/admin/users',
    '/admin/view-as'
  ];
  const violations: string[] = [];
  for (const route of routes) violations.push(...(await scanRoute(page, route)));
  for (const [list, prefix] of [
    ['/admin/support', '/admin/support/'],
    ['/admin/agency/proposals', '/admin/agency/proposals/']
  ] as const) {
    const href = await firstHref(page, list, prefix);
    if (href) violations.push(...(await scanRoute(page, href)));
  }
  expect(violations, violations.join('\n')).toEqual([]);
});

test('P4-1 public and sign-in pages pass the scan', async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const violations: string[] = [];
  for (const route of ['/sign-in', '/sign-in/help', '/sign-up']) {
    violations.push(...(await scanRoute(page, route)));
  }
  await context.close();
  expect(violations, violations.join('\n')).toEqual([]);
});

test('P4-1 staff two-step page passes the scan', async ({ enrolPage: page }) => {
  test.setTimeout(120_000);
  const violations = await scanRoute(page, '/staff/2fa');
  expect(violations, violations.join('\n')).toEqual([]);
});
