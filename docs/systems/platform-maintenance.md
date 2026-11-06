# Internal Kynetic platform maintenance

> Proposal-status document. Service family: **Platform & Engagement Services**. Source: handoff spec section 9 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| EXISTING | Backups: Twenty nightly 02:00 to `/var/backups/twenty` + R2 `kynetic-twenty-backups` (KYNETIC_CONTEXT.md); portal backup tests `crm/tests/integration/backups-m8b.test.ts`; `crm/deploy/prod/monitor/`; `tools/n8n_backup.py` (read-only). |
| EXISTING | Security/accessibility reviews: `docs/security-review-M10-01.md`, `docs/a11y-review-M10-04.md`; CI `.github/workflows/crm-ci.yml`, `crm-image.yml`, `crm-preview.yml` (run on crm/ changes only). |
| PARTIAL | VPS DEV workflows `ijQVSulzSU5HeQp5` (error-alert) and `cYHVXD1blenqvalE` (owner-alert), inactive; repo draft `n8n/drafts/m15-error-alert.js`, test `crm/tests/unit/n8n-error-alert.test.ts`. Importable error-workflow graph blocked earlier (automation-map B19). |
| UNKNOWN | n8n VPS version/edition, execution mode, persistence and reverse proxy: not read (the MCP exposes workflows/credentials only). |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-PLT-01 | Failed workflows produce actionable alert (tenant, system, correlation, attempt, sanitized code, owner). | Spec 5.1 | error workflow | — | T-PLT-01 |
| R-PLT-02 | Backup restore drill in isolated environment with evidence. | Spec 9.2 | scheduled check | — | T-PLT-02 |
| R-PLT-03 | No workflow auto-activates after deploy/restore; paused automation never stops opt-out ingestion. | Spec 9.2 | — | — | T-PLT-03 |
| R-PLT-04 | Operator commands allowlisted, RBAC, audited; client cannot invoke. | Spec 9.3 | — | — | T-PLT-04 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- n8n Community lacks external secrets/environments; deployment-level controls to inventory.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

