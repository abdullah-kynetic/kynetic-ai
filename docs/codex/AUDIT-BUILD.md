# Kynetic AI audit build

Status: local implementation scaffold and deterministic engine complete. Live deployment and external writes are intentionally not performed.

## Plan and file map

- `audit/models.py`: request/check contracts.
- `audit/scoring.py`: six-question tags and deterministic nine-problem scoring.
- `audit/checks/`: SEO, site-signal, mocked PageSpeed, Maps fixture parsing, AI mention parsing, and mode-gated wrappers.
- `audit/config.py`: eight business-type KPI templates and the `:free` model hard-fail.
- `audit/app.py` and `audit/local_server.py`: shared authenticated service handler, local HTTP harness, caps, idempotency, and Chromium PDF output.
- `audit/web/`: standalone four-step preview component because the kyneticai.com site source is not present in this repository.
- `audit/acceptance.py` and `audit/samples/`: ten synthetic operator acceptance records and PDFs.
- `audit/service.py`: authenticated, capped, idempotent local service boundary.
- `audit/pdf/`: branded HTML teaser source for Chromium PDF rendering.
- `audit/tests/`: unit and contract-boundary tests, including operator and blocked-page fixtures.
- `n8n/audit/`: export-only workflow definitions (not imported or activated).
- `crm/drizzle/0055_audit_results.sql`: additive schema migration using this repository's actual numbering.

## Decisions and constraints

- Operator mode never accepts or infers form answers; it scores automated evidence only.
- The existing portal's locked module catalog remains unchanged; `free_audit` is a source-specific lead path that bypasses `alex_core`, so existing module seed/isolation contracts do not regress.
- PhantomReach is not imported or called from the public engine. Any future operator adapter must remain behind an explicit mode check.
- No paid providers are selected. OpenRouter integration is not enabled in this local scaffold; when added, only `:free` model ids may pass validation.
- Migration convention verified: `crm/src/server/db/migrate.ts` calls Drizzle with `migrationsFolder: './drizzle'`; `crm/deploy/prod/deploy.sh:72-73` runs the Compose `migrate` service before the new app starts; `crm/deploy/Dockerfile:45-47` copies `drizzle/` into that image. The live convention in this repo is therefore `crm/drizzle/NNNN_*.sql`, not a `1090_staff_archive` series. The latest repo migration is `0054_tags_notification_prefs.sql`, so `0055_audit_results.sql` is correctly named.
- Existing repo instructions prohibit AGPL code, while the request names AGPL PhantomReach. It is not vendored; this is a deliberate license boundary.

## Verification log

- `python -m unittest discover -s audit/tests -p 'test_*.py'` — expected local suite for this layer.
- `python -m audit.acceptance` — ten synthetic operator runs, each with PDF, section scores, finding, and cost record.
- CRM and portal suites remain to be run after route/schema integration; no production database was touched.
- Modal deployment, live smoke tests, measured provider cost, n8n import, site discovery/deploy, and production migration are handoffs because the request forbids those writes and this workspace has no deployment credential.

## Handoffs

1. Create Modal secret `kynetic-audit-secrets` from environment-managed values only, then deploy only app `kynetic-audit`.
2. Import the JSON files in `n8n/audit/` into a non-production n8n workspace; keep credentials referenced by name and leave workflows inactive until reviewed.
3. Apply the CRM migration on a backed-up preview database first, then production only through the approved VPS change process.
4. Add Turnstile site/secret keys through deployment secret management; never commit them.

