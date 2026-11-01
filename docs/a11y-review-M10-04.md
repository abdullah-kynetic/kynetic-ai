# M10-04 Accessibility Review

**Status:** Automated checks pass; milestone remains blocked on the manual review below.

## Coverage and result

Automated axe checks used `@axe-core/playwright` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, and `wcag22aa`. The matrix covered 24 routes in light and dark themes at 1440px desktop and 390px mobile: 96 page-state scans, zero remaining violations.

| Area | Pages covered |
| --- | --- |
| Sign-in and consent | `/sign-in`, signed-in pending `/accept-terms` |
| Owner portal (15 routes) | Dashboard; contacts list and contact detail; pipeline; appointments; calls list and call detail; tasks; notifications; reports list and detail; business, team and branding settings; documents |
| Admin (7 routes) | All clients; client Alex detail and documents; users; audit log; integration health/operations; backups |

The first baseline scans identified five distinct product-affected DOM nodes: two low-contrast audit detail summaries, the mobile integration-health and backup table scroll regions, and the Kanban board's invalid `aria-orientation`. These were fixed in `d25d682` and `720b81f`. A separate dark branding-preview contrast report occurred when the test forced the `.dark` class directly; it was not reproduced with the app's actual theme toggle. The preview now selects the color derived for the active theme (`246d35d`). The final matrix uses the real theme control where available and has zero axe violations.

Keyboard/focus checks passed for sign-in tab order, dialog focus return and Escape, and primary controls on contacts, appointments and tasks. The browser-response secret check also passed.

**Manual screen-reader review:** not verified, needs a human screen-reader pass.

## Commands and evidence

Run from `crm/` with the disposable PostgreSQL 16 endpoint and synthetic E2E seed:

```sh
bun run build
PLAYWRIGHT_CHROMIUM_PATH="$(find /home/box/.cache/ms-playwright -type f \( -path '*/chrome-linux/chrome' -o -path '*/chrome-linux64/chrome' \) | head -n 1)" \
  TEST_DATABASE_ADMIN_URL=postgres://postgres:synthetic@127.0.0.1:55432/postgres \
  bun run test:e2e -- tests/e2e/m10-a11y-security.spec.ts tests/e2e/shell.spec.ts
bun run typecheck
bun run test -- tests/unit/branding-color.test.ts
```

Results: build passed; browser suites passed **21/21**; typecheck passed; branding color unit suite passed **17/17**. The broad test commit is `d96feeb`; the admin table, Kanban ARIA, and theme-aware branding fixes are `d25d682`, `720b81f`, and `246d35d` respectively.

Automated axe does not replace manual screen-reader and full keyboard interaction review. M10-04 remains blocked until a human performs and records that review.
