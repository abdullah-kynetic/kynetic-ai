# kynetic-ai

Working repo for Kynetic AI. Twenty CRM is the system of record. This repo mirrors it: agent rules, the Plan 1 outbound build, and the decision log. If a doc disagrees with Twenty, Twenty wins.

## Layout

| Path | What it is |
|---|---|
| `KYNETIC_CONTEXT.md` | Rules, IDs, D-017 pricing, the two Retell workspaces |
| `CLAUDE.md` | Agent instructions. `AGENTS.md` points here |
| `docs/` | `progress.md`, `decisions.md` (D-001 through D-018), `known-issues.md`, counsel notes |
| `retell/builds/outbound-speed-to-lead/` | Plan 1: Alex, the Kynetic Roofing demo, the n8n mapping |
| `retell/PROMPTING_STYLE.md` | House style for Retell prompts |
| `tools/retell.py` | Retell API client. Dry-run unless `--apply` |
| `retell/builds/emily-speed-to-lead/` | Plan 2 Emily build, paused |
| `retell/builds/kynetic-restoration/` | Kynetic Restoration (Demo). Leave it alone |
| `.claude/skills/` | `brand-profile`, `retell-builder`, `build-log` |
| `Claude Skills/` | Other skill notes, including `skills-breakdown.md` |
| `archive/` | Parked Vapi prompt, the old lead-scrape flow, the old trade-receptionist export, the SeldonFrame build log |

Secrets stay in `.env` (see `.env.example`) or in the cloud environment. Never commit them.

Nora (`agent_4c34644a04c74e27253e80167b`, n8n `2PFWFqBM0wabADk6`) is frozen. New Retell builds go in the `abdullahblitz` workspace. Nora and Emily stay in `kyneticai`.
