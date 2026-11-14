import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.describe('P2 archive pages (staff only)', () => {
  test('notes: search finds a note by a body phrase and the note opens', async ({ adminPage }) => {
    await adminPage.goto('/admin/archive/notes');
    await expect(adminPage.getByRole('heading', { name: 'Archive' })).toBeVisible();
    await adminPage.getByLabel('Search title and text').fill('not reviewed by an attorney');
    await adminPage.getByRole('button', { name: 'Search', exact: true }).click();
    await adminPage.getByRole('link', { name: 'TCPA Consent & Opt-Out Language' }).click();
    await expect(
      adminPage.getByRole('heading', { name: 'TCPA Consent & Opt-Out Language' })
    ).toBeVisible();
    await expect(adminPage.getByText('Draft, not reviewed by an attorney')).toBeVisible();
  });

  test('tasks: filter by status', async ({ adminPage }) => {
    await adminPage.goto('/admin/archive/tasks?status=DONE');
    await expect(adminPage.getByRole('region', { name: 'Tasks' })).toBeVisible();
    await expect(adminPage.getByText(/Revoke the leaked Cal\.com key/)).toBeVisible();
  });

  test('attachments and records load', async ({ adminPage }) => {
    await adminPage.goto('/admin/archive/attachments');
    await expect(adminPage.getByText('wave2-raw.csv')).toBeVisible();
    await adminPage.goto('/admin/archive/records');
    await expect(adminPage.getByText('AM-1 Roofing Inc').first()).toBeVisible();
  });

  test('VA can read; the list is read-only (no edit controls)', async ({ vaPage }) => {
    await vaPage.goto('/admin/archive/notes');
    await expect(vaPage.getByRole('heading', { name: 'Archive' })).toBeVisible();
    await expect(vaPage.getByRole('button', { name: /delete|edit|save/i })).toHaveCount(0);
  });

  const PAGES = [
    '/admin/archive/notes',
    '/admin/archive/tasks',
    '/admin/archive/attachments',
    '/admin/archive/records'
  ];
  const ID = '99999999-9999-4999-8999-999999999999';

  test('P2-2 a client user is refused on every archive page and file link', async ({
    authenticatedPage
  }) => {
    for (const path of PAGES) {
      const res = await authenticatedPage.goto(path);
      expect(res?.status(), path).toBe(403);
      await expect(authenticatedPage.getByText('Agency Overview')).toHaveCount(0);
    }
    const note = await authenticatedPage.goto(`/admin/archive/notes/${ID}`);
    expect(note?.status()).toBe(403);
    const dl = await authenticatedPage.request.get(
      `/api/admin/archive/attachments/${ID}/download`,
      { maxRedirects: 0 }
    );
    expect(dl.status()).toBe(403);
  });

  test('P2-2 an anonymous request gets no archive page or file', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (const path of PAGES) {
      const res = await page.goto(path);
      // Anonymous visitors are sent to sign-in (or get a 401); either way no archive content.
      expect(page.url().includes('/sign-in') || res?.status() === 401, path).toBe(true);
      await expect(page.getByText('Agency Overview')).toHaveCount(0);
    }
    const dl = await context.request.get(`/api/admin/archive/attachments/${ID}/download`, {
      maxRedirects: 0
    });
    expect(dl.status()).toBe(401);
    await context.close();
  });

  test('P2-6 pages pass the accessibility scan and fit a 390 px screen', async ({ adminPage }) => {
    test.setTimeout(120_000);
    const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
    const problems: string[] = [];
    await adminPage.goto('/admin/archive/notes?q=Welcome');
    const noteHref = await adminPage
      .locator('a[href^="/admin/archive/notes/"]')
      .first()
      .getAttribute('href');
    expect(noteHref).toBeTruthy();
    const routes = [
      ...PAGES,
      '/admin/archive/notes?q=pricing',
      '/admin/archive/tasks?status=TODO',
      noteHref!
    ];
    for (const width of [1280, 390]) {
      await adminPage.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await adminPage.goto(route);
        const result = await new AxeBuilder({ page: adminPage }).withTags(tags).analyze();
        for (const v of result.violations) problems.push(`${width} ${route}: ${v.id}`);
        if (width === 390) {
          const overflow = await adminPage.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1
          );
          if (overflow) problems.push(`390 ${route}: page scrolls sideways`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
