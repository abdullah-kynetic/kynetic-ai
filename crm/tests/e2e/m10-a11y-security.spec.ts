import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const ownerRoutes = [
  '/dashboard',
  '/dashboard/contacts',
  '/dashboard/appointments',
  '/dashboard/tasks',
  '/dashboard/documents',
  '/dashboard/settings/branding'
];

test('M10-04 WCAG 2.2 AA automated scan on owner daily-use routes', async ({ authenticatedPage }) => {
  const violations: string[] = [];
  for (const route of ownerRoutes) {
    await authenticatedPage.goto(route);
    const results = await new AxeBuilder({ page: authenticatedPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    violations.push(...results.violations.map((v) => `${route}: ${v.id} ${v.nodes.map((n) => n.target.join(',')).join('; ')}`));
  }
  expect(violations, violations.join('\n')).toEqual([]);
});

test('M10-04 WCAG 2.2 AA automated scan on admin operations and backup routes', async ({ adminPage }) => {
  const violations: string[] = [];
  for (const route of ['/admin', '/admin/operations', '/admin/backups', '/admin/users']) {
    await adminPage.goto(route);
    const results = await new AxeBuilder({ page: adminPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    violations.push(...results.violations.map((v) => `${route}: ${v.id} ${v.nodes.map((n) => n.target.join(',')).join('; ')}`));
  }
  expect(violations, violations.join('\n')).toEqual([]);
});

test('F-87 provider configuration and secrets are absent from browser responses', async ({ authenticatedPage, adminPage }) => {
  const responses: string[] = [];
  const capture = (response: { url(): string; headers(): Record<string, string>; status(): number }) => {
    if (response.url().includes('/_next/') || response.url().includes('/api/')) {
      responses.push(`${response.url()} ${response.status()} ${JSON.stringify(response.headers())}`);
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

test('M10-04 keyboard navigation reaches primary controls on daily-use pages', async ({ authenticatedPage }) => {
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
