# Objects index

7 cards verified 2026-10-22 (`objects/<cluster>/<slug>.md`); the rest are stubs with no card.

Format: `slug | cluster | universe | status | owning path`.

## alex
- alex-agent | alex | live | verified | retell/builds/outbound-speed-to-lead/agent.config.json (live agent id in KYNETIC_CONTEXT.md)
- alex-prompt | alex | live | stub | retell/builds/outbound-speed-to-lead/PROMPT.md (v1.2.3 is on branch claude/alex-demo-live-test, not main)
- alex-demo-business | alex | live | stub | retell/builds/outbound-speed-to-lead/demo-business/
- alex-form-spec | alex | live | stub | retell/builds/outbound-speed-to-lead/FORM_SPEC.md
- prompting-style | alex | live | stub | retell/PROMPTING_STYLE.md

## lead
- outbound-speed-to-lead-workflow | lead | live | verified | n8n/workflows/active/outbound-speed-to-lead__m2YJwZ1l8DTzyEkw.json (cloud copy; VPS copy not in repo)
- twenty-lead-objects | lead | live | stub | KYNETIC_CONTEXT.md "Twenty" (endCustomer, customerInteraction, client_accounts)
- cal-roof-inspection-event | lead | live | stub | KYNETIC_CONTEXT.md (event type 7404470)
- pricing-d017 | lead | live | stub | docs/decisions.md D-017
- voice-bakeoff | lead | ghost | stub | on branches only (providers/ not on main); Twenty note is canonical

## n8n
- n8n-backup-copy | n8n | live | verified | n8n/workflows/, n8n/manifest.json, tools/n8n_backup.py
- n8n-credentials-inventory | n8n | live | stub | n8n/CREDENTIALS.md (names only)
- n8n-vps-instance | n8n | ghost-in-repo | stub | not in repo; Abdullah 2026-10-21: canonical, workflow tXJwNTkNgKGnp0Ab
- vapi-workflows | n8n | leftover | stub | n8n/workflows/archive/*vapi*

## retell
- retell-client | retell | live | verified | tools/retell.py (dry-run unless --apply)
- retell-agent-tools | retell | live | stub | NO-TOUCH class; see KYNETIC_CONTEXT.md rule 2
- retell-allowlist | retell | live | stub | .claude/settings.json

## frozen
- nora | frozen | live | stub | n8n/workflows/active/nora-restoration-ai-receptionist__2PFWFqBM0wabADk6.json; NO-TOUCH
- emily | frozen | leftover | stub | retell/builds/emily-speed-to-lead/; paused; NO-TOUCH
- kynetic-restoration-demo | frozen | live | stub | retell/builds/kynetic-restoration/build-ids.md; NO-TOUCH
- inflate-original | frozen | leftover | stub | retell/builds/_inflate-original/; leave alone

## portal
- portal-tenancy-rls | portal | live | verified | portal/src/lib/db/, portal/drizzle/0001_rls.sql
- portal-auth | portal | live | stub | portal/src/lib/auth/, portal/src/app/(auth)/
- portal-ingest-api | portal | live | verified | portal/src/app/api/ingest/, portal/N8N.md
- portal-files-storage | portal | live | stub | portal/src/lib/storage/, portal/src/app/api/files/
- portal-deploy | portal | live | verified | portal/deploy/ (server copies are separate; trigger lives outside repo)

## docs
- context-docs-mirror | docs | live | stub | docs/progress.md, decisions.md, known-issues.md, KYNETIC_CONTEXT.md (mirror of Twenty)
- decision-log | docs | live | stub | docs/decisions.md (D-001..D-022)
- known-issues | docs | live | stub | docs/known-issues.md (KI-001..KI-010)

## tooling
- repo-skills | tooling | live | stub | .claude/skills/, skills-breakdown.md
- mcp-config | tooling | live | stub | .mcp.json, .env.example (names only)
