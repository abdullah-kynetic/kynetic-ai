# Free Audit implementation record

Base 614b7e40. Historical audit reference e3e968561afdd7280aab0c1d282ababa3d17d82c. Coordinator owns integration and deployment. Sending stays off.

## Evidence loss in the historical implementation

1. service.collect_checks builds nested provider results. service.run returns checks alongside scores. The structured provider payload still exists at that boundary.
2. scoring.score reads questionnaire answers and just one automated signal, SEO indexability. It hardcodes the automated section score to zero. scoring.findings takes only the first piece of evidence per problem, stops at three and pads short lists with the same fallback sentence.
3. The audit-results service route accepts scores, findings and a PDF key. Its strict schema has no dedicated checks, source or observation time field. Migration 0055 likewise has no evidence column. Generic JSON fields could hold additional data, but the contract does not require preservation.
4. app.handle_request passes only name, overall score and findings to render_pdf. Both editions call the same teaser template. teaser.render_html slices the list again and renders a heading, number, three bullets and booking prompt. Its CSS specifies teal for two elements; the apparent monochrome output is not explained by a missing Chromium background flag (print_background is already true).
5. service._cache and request accounting are process-local. A restart discards idempotency state. A PDF exception becomes a null URL without failing the request.
6. Vendor README identifies original compatible implementations for three MIT references and an excluded AGPL project. This establishes neither upstream feature parity nor the identity of the operator's local full-report build.

## Delivery phases and acceptance

- Identify upstream checkout and compare actual outputs. Trace the active intake and tenant context before choosing integration points.
- Define timestamped evidence and internal provenance; isolate report-safe fields. Test unavailable, challenge, timeout and empty responses with fake transports. Model financial ranges with explicit inputs.
- Integrate durable tenant-scoped requests, retries, collection limits and report retrieval. Validate additive migrations on empty and seeded databases and isolation under a non-owner role. Keep sending disabled.
- Generate distinct branded HTML/PDF editions, inspect pagination and accessibility, and record sources for PRI-Premiere Roofing plus two verified eligible businesses.
- Run unit, integration, intake E2E, build, typecheck and lint; report exact-SHA CI and hosting dependencies. Roll back by disabling intake processing and reverting application changes while retaining stored evidence.

Status: historical source trace complete. Implementation, sample artifacts and release verification pending.

## 2026-11-20 rebuild plan

The full build spec is `docs/coordinator/free-audit-blueprint.md` (branch `claude/project-thread-wuzri7`). WIP commit 6e4475a has the new checks, scoring and findings. Pipeline, async webhook, report, tests and samples are pending per tasks T1-T10 in the blueprint.
