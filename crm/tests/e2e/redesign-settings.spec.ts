import { expect, test } from './fixtures';

const pages = [
  ['business', '/dashboard/settings/business'],
  ['team', '/dashboard/settings/team'],
  ['branding', '/dashboard/settings/branding'],
  ['pipeline', '/dashboard/settings/pipeline'],
  ['tags', '/dashboard/settings/tags'],
  ['notifications', '/dashboard/settings/notifications'],
  ['automations', '/dashboard/settings/automations'],
  ['custom-fields', '/dashboard/settings/custom-fields'],
  ['alex', '/dashboard/settings/alex']
] as const;

test('Settings routes render without horizontal overflow', async ({ authenticatedPage: page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, path] of pages) {
      await page.goto(path);
      await expect(page.locator('h1').last()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      );
      if (process.env.SHOT_PREFIX) {
        await page.screenshot({
          path: `${process.env.SHOT_PREFIX}-${name}-${width}.png`,
          fullPage: true
        });
      }
    }
  }
});

test('Business settings report save success and validation errors', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/business');
  const timeZone = page.getByLabel('Time zone');
  const original = await timeZone.inputValue();
  const save = page.getByRole('button', { name: 'Save', exact: true });
  try {
    await timeZone.fill('America/Denver');
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    await timeZone.fill('America/Chicago');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(timeZone).toHaveValue('America/Denver');
    await page.reload();
    await expect(timeZone).toHaveValue('America/Denver');
  } finally {
    await timeZone.fill(original);
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  }
  await page.route('**/api/settings/business', async (route) => {
    await route.fulfill({
      status: 400,
      json: { error: { message: 'Invalid settings' } }
    });
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Business settings were not saved' })
  ).toContainText('Invalid settings');
});

test('Settings stay usable in dark mode and with keyboard focus', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/business');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Time zone').focus();
  await expect(page.getByLabel('Time zone')).toBeFocused();
  if (process.env.SHOT_PREFIX) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${process.env.SHOT_PREFIX}-business-dark-390.png`,
      fullPage: true
    });
  }
});

test('Every Settings page renders in dark mode on desktop', async ({ authenticatedPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/dashboard/settings/business');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  for (const [name, path] of pages) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { level: 1 }).last()).toBeVisible();
    await expect(
      page.locator('nav[aria-label="Settings pages"] a[aria-current="page"]')
    ).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      name
    ).toBeLessThanOrEqual(1280);
    if (process.env.SHOT_PREFIX) {
      await page.screenshot({
        path: `${process.env.SHOT_PREFIX}-${name}-dark-1280.png`,
        fullPage: true
      });
    }
  }
});

test('Owner can pause Alex and persist only the settings flag', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/alex');
  const checkbox = page.getByRole('checkbox', { name: /Pause Alex/ });
  await expect(checkbox).toBeVisible();
  const initiallyChecked = await checkbox.isChecked();
  try {
    if (initiallyChecked) await checkbox.uncheck();
    else await checkbox.check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    await page.reload();
    expect(await checkbox.isChecked()).toBe(!initiallyChecked);
    await checkbox.setChecked(initiallyChecked);
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await checkbox.isChecked()).toBe(!initiallyChecked);
  } finally {
    if (initiallyChecked) await checkbox.check();
    else await checkbox.uncheck();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  }
});

test('Alex settings show read-only access during staff view-as', async ({ adminPage: page }) => {
  await page.goto('/admin/clients');
  await page
    .getByRole('row')
    .filter({ hasText: 'Ready Roofing' })
    .getByRole('button', { name: 'View as client' })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/settings/alex');
  await expect(page.getByText('This view is read-only.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Pause Alex/ })).toHaveCount(0);
  await page.goto('/dashboard/settings/branding');
  await expect(page.getByText('This view is read-only.')).toBeVisible();
  await expect(page.getByLabel('Business name')).toHaveCount(0);
});

test('CRM-disabled workspace retains its settings access message', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: '/tmp/kynetic-crm-e2e-lane-a-owner-b.json'
  });
  const page = await context.newPage();
  await page.goto('/dashboard/settings/pipeline');
  await expect(page.getByText('Configurable stages are part of the CRM build-out.')).toBeVisible();
  await context.close();
});

test('Unauthenticated visitors cannot open settings', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/dashboard/settings/team');
  await expect(page).toHaveURL(/sign-in/);
  await context.close();
});

test('Notification preferences show a save error', async ({ authenticatedPage: page }) => {
  await page.goto('/dashboard/settings/notifications');
  await page.route('**/api/settings/notifications', async (route) => {
    await route.fulfill({
      status: 500,
      json: { error: { message: 'Unable to save preferences' } }
    });
  });
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Preferences were not saved' })
  ).toContainText('Unable to save preferences');
});

test('Notification Cancel restores the latest saved preferences', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/notifications');
  const checkbox = page.getByRole('checkbox', { name: 'New lead' });
  const original = await checkbox.isChecked();
  try {
    await checkbox.setChecked(!original);
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Preferences saved.' })).toBeVisible();
    await checkbox.setChecked(original);
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await checkbox.isChecked()).toBe(!original);
  } finally {
    await checkbox.setChecked(original);
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Preferences saved.' })).toBeVisible();
  }
});

test('Branding Cancel restores the latest saved business name', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/branding');
  const name = page.getByLabel('Business name');
  const original = await name.inputValue();
  try {
    await name.fill('Synthetic branding test');
    await page.getByRole('button', { name: 'Save branding' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Branding saved.' })).toBeVisible();
    await name.fill('Unsaved branding test');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(name).toHaveValue('Synthetic branding test');
    await page.reload();
    await expect(name).toHaveValue('Synthetic branding test');
  } finally {
    await name.fill(original);
    await page.getByRole('button', { name: 'Save branding' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Branding saved.' })).toBeVisible();
  }
});

test('Staff can read business settings and cannot manage the team or branding', async ({
  browser
}) => {
  const context = await browser.newContext({
    storageState: '/tmp/kynetic-crm-e2e-staff.json'
  });
  try {
    const page = await context.newPage();
    await page.goto('/dashboard/settings/business');
    await expect(page.getByRole('heading', { name: 'Business settings' })).toBeVisible();
    await expect(page.getByLabel('Time zone')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);

    await page.goto('/dashboard/settings/team');
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'You do not have access' })
    ).toBeVisible();

    await page.goto('/dashboard/settings/branding');
    await expect(page.getByRole('heading', { name: 'Branding' })).toBeVisible();
    await expect(page.getByText('Only the account owner can change branding.')).toBeVisible();
    await expect(page.getByLabel('Business name')).toHaveCount(0);

    await page.goto('/dashboard/settings/alex');
    await expect(page.getByRole('heading', { name: 'Alex settings' })).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Only the account owner' })
    ).toBeVisible();
    await expect(page.getByLabel('Pause Alex')).toHaveCount(0);

    await page.goto('/dashboard/settings/automations');
    await expect(
      page.getByRole('status').filter({ hasText: 'Only the account owner' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Enable|Disable)$/ })).toHaveCount(0);

    for (const [route, title, action] of [
      ['pipeline', 'Pipeline stages', 'Add stage'],
      ['tags', 'Tags', 'Add tag'],
      ['custom-fields', 'Custom fields', 'Add field']
    ] as const) {
      await page.goto(`/dashboard/settings/${route}`);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: action })).toHaveCount(0);
    }
    await page.goto('/dashboard/settings/notifications');
    await expect(page.getByRole('heading', { name: 'Notification preferences' })).toBeVisible();
  } finally {
    await context.close();
  }
});
