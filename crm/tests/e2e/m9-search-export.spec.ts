import { expect, test } from './fixtures';

test('F-37 Cmd+K finds a contact by phone fragment', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await authenticatedPage.getByRole('button', { name: /Search/ }).click();
  const search = authenticatedPage.getByRole('combobox');
  await search.fill('5555550101');
  await expect(authenticatedPage.getByText('Contact a')).toBeVisible();
});

test('F-38 contacts CSV export downloads the current tenant view', async ({
  authenticatedPage
}) => {
  await authenticatedPage.goto('/dashboard/contacts');
  const downloadPromise = authenticatedPage.waitForEvent('download');
  await authenticatedPage.getByRole('link', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('contacts.csv');
});

test('F-44 daily-use shell has no horizontal overflow at 390px', async ({ authenticatedPage }) => {
  await authenticatedPage.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    '/dashboard',
    '/dashboard/contacts',
    '/dashboard/appointments',
    '/dashboard/tasks'
  ]) {
    await authenticatedPage.goto(route);
    await expect(authenticatedPage.locator('body')).toBeVisible();
    const dimensions = await authenticatedPage.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content, `${route} should not overflow horizontally`).toBeLessThanOrEqual(
      dimensions.viewport
    );
  }
});

test('F-44 daily-use touch targets are at least 44 by 44 CSS pixels at 390px', async ({
  authenticatedPage
}) => {
  await authenticatedPage.setViewportSize({ width: 390, height: 844 });
  const smallTargets: string[] = [];
  for (const route of [
    '/dashboard',
    '/dashboard/contacts',
    '/dashboard/appointments',
    '/dashboard/tasks',
    '/dashboard/documents'
  ]) {
    await authenticatedPage.goto(route);
    const undersized = await authenticatedPage
      .locator(
        'a[href], button, input:not([type="hidden"]):not([type="checkbox"]), select, textarea, [role="button"], [data-slot="checkbox"]'
      )
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (
            element.classList.contains('sr-only') ||
            rect.width === 0 ||
            rect.height === 0 ||
            style.visibility === 'hidden' ||
            style.display === 'none'
          )
            return [];
          return rect.width < 44 || rect.height < 44
            ? [
                `${element.tagName.toLowerCase()} ${element.textContent?.trim().slice(0, 36) || (element as HTMLInputElement).type || ''}: ${Math.round(rect.width)}x${Math.round(rect.height)}`
              ]
            : [];
        })
      );
    smallTargets.push(...undersized.map((target) => `${route}: ${target}`));
  }
  expect(smallTargets, smallTargets.join('\n')).toEqual([]);
});

test('F-44 contact phone offers a 44px tel link without opening the dialer', async ({
  authenticatedPage
}) => {
  await authenticatedPage.setViewportSize({ width: 390, height: 844 });
  await authenticatedPage.goto('/dashboard/contacts');
  await authenticatedPage.locator('a[href^="/dashboard/contacts/"]').first().click();
  const phone = authenticatedPage.locator('a[href^="tel:"]').first();
  await expect(phone).toBeVisible();
  await expect(phone).toHaveAttribute('href', /^tel:\+/);
  const box = await phone.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
});

test('F-39 saved synthetic branding appears in settings and across portal routes', async ({
  authenticatedPage
}) => {
  await authenticatedPage.goto('/dashboard/settings/branding');
  await expect(authenticatedPage.getByLabel('Business name')).toHaveValue('Synthetic Brand Co');
  await expect(authenticatedPage.locator('#primaryColor')).toHaveValue('#2563eb');
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage.getByText('Synthetic Brand Co', { exact: true })).toBeVisible();
  const branding = await authenticatedPage.locator('style').allTextContents();
  expect(branding.join('\n')).toContain('#2563eb');
  for (const route of ['/dashboard/contacts', '/dashboard/appointments']) {
    await authenticatedPage.goto(route);
    await expect(authenticatedPage.getByText('Synthetic Brand Co', { exact: true })).toBeVisible();
    expect((await authenticatedPage.locator('style').allTextContents()).join('\n')).toContain(
      '#2563eb'
    );
  }
});
