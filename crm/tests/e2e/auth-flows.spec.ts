import { expect, test } from './fixtures';

test('sign-up, log-in and recovery are separate, and unknown emails stay neutral', async ({
  page
}) => {
  await page.goto('/sign-up');
  await expect(page.getByRole('heading', { name: 'Sign up', exact: true })).toBeVisible();
  await expect(page.getByText('no account is created')).toBeVisible();
  await page.getByRole('link', { name: 'Already have access? Log in' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'First time? Sign up' })).toBeVisible();

  await page.getByLabel('Work email', { exact: true }).fill('nobody@example.test');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('status')).toContainText('If you have access, we sent a code');
  await expect(page.getByLabel('Confirmation code')).toBeVisible();

  await page.goto('/sign-in/help');
  await expect(page.getByRole('heading', { name: "Can't sign in?" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me a new code' })).toBeVisible();
  await expect(page.getByText('There are no backup codes.')).toBeVisible();
});

test('staff enrolment shows a QR code and hides the secret until requested', async ({
  enrolPage
}) => {
  await enrolPage.goto('/staff/2fa');
  await expect(enrolPage.getByRole('heading', { name: 'Set up your authenticator' })).toBeVisible();
  await expect(enrolPage.getByText('Recovery codes')).toHaveCount(0);
  await enrolPage.getByRole('button', { name: 'Start setup' }).click();
  await expect(enrolPage.getByRole('img', { name: 'Authenticator QR code' })).toBeVisible();
  await expect(enrolPage.getByText('Recovery codes')).toHaveCount(0);
  await expect(enrolPage.locator('code')).toHaveCount(0);
  await enrolPage.getByRole('button', { name: "Can't scan the code?" }).click();
  await expect(enrolPage.locator('code')).toBeVisible();
});

test('an admin can reset another staff member authenticator', async ({ adminPage }) => {
  await adminPage.goto('/admin/users?q=reset-va@example.test');
  const row = adminPage.getByRole('row').filter({ hasText: 'reset-va@example.test' });
  await row.getByRole('button', { name: 'Reset authenticator' }).click();
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Reset authenticator' }).click();
  await expect(
    adminPage.getByText('Authenticator reset. They sign in with Google and enroll again.')
  ).toBeVisible();
});
