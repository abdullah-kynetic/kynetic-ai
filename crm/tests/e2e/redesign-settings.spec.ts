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
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(timeZone).toHaveValue('America/Denver');
    await page.reload();
    await expect(timeZone).toHaveValue('America/Denver');
  } finally {
    await timeZone.fill(original);
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  }
  await page.route('**/api/settings/business', async (route) => {
    await route.fulfill({ status: 400, json: { error: { message: 'Invalid settings' } } });
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Business settings were not saved' })
  ).toContainText('Invalid settings');
});

test('Alex rejects invalid call hours and Cancel restores pause and hours', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/alex');
  const start = page.getByLabel('Calls start at');
  const end = page.getByLabel('Calls stop at');
  const pause = page.getByRole('checkbox', { name: /Pause Alex/ });
  const originalStart = await start.inputValue();
  const originalEnd = await end.inputValue();
  const originallyPaused = await pause.isChecked();

  await start.fill('20:00');
  await end.fill('10:00');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Alex settings were not saved' })
  ).toContainText('Start must be before end.');

  await page.reload();
  await expect(start).toHaveValue(originalStart);
  await expect(end).toHaveValue(originalEnd);
  await expect(pause).toBeChecked({ checked: originallyPaused });

  await start.fill('08:30');
  await pause.click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(start).toHaveValue(originalStart);
  await expect(pause).toBeChecked({ checked: originallyPaused });
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

test('Notification preferences stay editable after an invalid success response', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/notifications');
  await page.route('**/api/settings/notifications', (route) =>
    route.fulfill({ status: 200, json: { ok: true } })
  );
  const save = page.getByRole('button', { name: 'Save preferences' });
  await save.click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Preferences were not saved' })
  ).toContainText('Could not save.');
  await expect(save).toBeEnabled();
  await expect(page.getByRole('checkbox').first()).toBeVisible();
});

test('Staff can read business settings and cannot manage the team or branding', async ({
  browser
}) => {
  const context = await browser.newContext({ storageState: '/tmp/kynetic-crm-e2e-staff.json' });
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
  } finally {
    await context.close();
  }
});
