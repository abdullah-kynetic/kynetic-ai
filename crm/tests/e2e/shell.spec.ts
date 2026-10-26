import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('F-52: the root sends a signed-out visitor to the Kynetic sign-in page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByAltText('Kynetic').first()).toBeAttached();
});

test('F-52: a signed-out visitor cannot load the dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('F-52: starter demo routes are gone', async ({ request }) => {
  for (const path of ['/dashboard/kanban', '/dashboard/chat', '/auth/sign-in', '/api/users']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
  }
});

test('M0-23: sign-in works from the keyboard', async ({ page }) => {
  await page.goto('/sign-in');
  // The theme toggle comes first in the tab order, then the email field, then the submit button.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Work email')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeFocused();
});

test('M0-23: light by default, dark on request, and the choice sticks', async ({ page }) => {
  await page.goto('/sign-in');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'kynetic');
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
});

test('M0-23: the system color scheme is never followed', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/sign-in');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await context.close();
});

for (const mode of ['light', 'dark'] as const) {
  test(`M0-23: sign-in has no axe violations (${mode})`, async ({ page }) => {
    await page.goto('/sign-in');
    if (mode === 'dark') {
      await page.getByRole('button', { name: 'Toggle theme' }).click();
      await expect(page.locator('html')).toHaveClass(/dark/);
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('M0-23: sign-in fits a 390px phone with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-in');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBe(0);
});
