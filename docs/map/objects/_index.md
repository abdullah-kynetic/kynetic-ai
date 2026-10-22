# Objects index

22 cards verified 2026-10-22 (`objects/<cluster>/<slug>.md`); the remaining entries are stubs. Processes: `../processes/`. Change index: `../effects/CONTEXT.md`.

Format: `slug | cluster | universe | status | owning path`.

## alex
- alex-agent | alex | live | verified | retell/builds/outbound-speed-to-lead/agent.config.json (live agent id in KYNETIC_CONTEXT.md)
- alex-prompt | alex | live | verified | retell/builds/outbound-speed-to-lead/PROMPT.md (v1.2.3 is on branch claude/alex-demo-live-test, not main)
- alex-demo-business | alex | live | stub | retell/builds/outbound-speed-to-lead/demo-business/
- alex-form-spec | alex | live | verified | retell/builds/outbound-speed-to-lead/FORM_SPEC.md
- prompting-style | alex | live | stub | retell/PROMPTING_STYLE.md

## lead
- outbound-speed-to-lead-workflow | lead | live | verified | n8n/workflows/active/outbound-speed-to-lead__m2YJwZ1l8DTzyEkw.json (cloud copy; VPS copy not in repo)
- twenty-lead-objects | lead | live | verified | KYNETIC_CONTEXT.md "Twenty" (endCustomer, customerInteraction, client_accounts)
- cal-roof-inspection-event | lead | live | stub | KYNETIC_CONTEXT.md (event type 7404470)
- pricing-d017 | lead | live | verified | docs/decisions.md D-017

## n8n
- n8n-backup-copy | n8n | live | verified | n8n/workflows/, n8n/manifest.json, tools/n8n_backup.py
- n8n-credentials-inventory | n8n | live | stub | n8n/CREDENTIALS.md (names only)
- n8n-vps-instance | n8n | ghost-in-repo | stub | not in repo; Abdullah 2026-10-21: canonical, workflow tXJwNTkNgKGnp0Ab
- vapi-workflows | n8n | leftover | stub | n8n/workflows/archive/*vapi*

## retell
- retell-client | retell | live | verified | tools/retell.py (dry-run unless --apply)
- retell-agent-tools | retell | live | verified | NO-TOUCH class; see KYNETIC_CONTEXT.md rule 2
- retell-allowlist | retell | live | verified | .claude/settings.json

## plan2 (inbound receptionists and upsells; Nora and Emily are no-touch)
- nora | plan2 | live | verified | n8n/workflows/active/nora-restoration-ai-receptionist__2PFWFqBM0wabADk6.json; NO-TOUCH
- emily | plan2 | leftover | verified | retell/builds/emily-speed-to-lead/; paused; NO-TOUCH
- kynetic-restoration-demo | plan2 | live | stub | retell/builds/kynetic-restoration/build-ids.md; NO-TOUCH
- inflate-original | plan2 | leftover | stub | retell/builds/_inflate-original/; leave alone
- upsell-workflows | plan2 | leftover | stub | n8n/workflows/archive/ (review chain, reactivation sender + reply handler, missed-call text-back, appointment setter); Twenty tasks tagged [P2] LATER UPSELL

## bakeoff (voice provider test, parallel to Plan 1; no decision logged)
- bakeoff-summary | bakeoff | ghost | verified | providers/BAKEOFF_SUMMARY.md on branch claude/provider-test-elevenlabs (not on main); Twenty note "VOICE PROVIDER BAKE-OFF" and task 3.9 are canonical
- bakeoff-elevenlabs-agents | bakeoff | ghost | stub | ElevenLabs v1/v2 agents on the second account; ids in Twenty note, not in this repo
- bakeoff-11labs-workflow | bakeoff | ghost | stub | VPS n8n xlmyRd5jBBBu8LX7 (inactive; agent and phone-number ids still placeholders when read 2026-10-22); not in repo

## leadsourcing (Meta-ads owner list for human dialing, parallel to Plan 1)
- lead-engine | leadsourcing | ghost | verified | docs/lead-engine-handoff.md, tools/lead_enrich.py on branch claude/modest-thompson-h9atoy (not on main); Twenty note "LEAD ENGINE: Run B + pilots handoff"
- lead-list-twenty-load | leadsourcing | live | stub | Twenty tasks 2.1-2.5 (Companies with a source for every fact)

## portal
- portal-tenancy-rls | portal | live | verified | portal/src/lib/db/, portal/drizzle/0001_rls.sql
- portal-auth | portal | live | verified | portal/src/lib/auth/, portal/src/app/(auth)/
- portal-ingest-api | portal | live | verified | portal/src/app/api/ingest/, portal/N8N.md
- portal-files-storage | portal | live | verified | portal/src/lib/storage/, portal/src/app/api/files/
- portal-deploy | portal | live | verified | portal/deploy/ (server copies are separate; trigger lives outside repo)

## docs
- context-docs-mirror | docs | live | verified | docs/progress.md, decisions.md, known-issues.md, KYNETIC_CONTEXT.md (mirror of Twenty)
- decision-log | docs | live | stub | docs/decisions.md (D-001..D-022)
- known-issues | docs | live | stub | docs/known-issues.md (KI-001..KI-010)

## tooling
- repo-skills | tooling | live | verified | .claude/skills/, skills-breakdown.md
- mcp-config | tooling | live | verified | .mcp.json, .env.example (names only)
