# kynetic-ai

Working repo for Kynetic AI. Twenty CRM is canonical; this repo contains the
CRM/portal application, the Plan 1 outbound build, and the decision log. On a
mismatch, flag it rather than silently picking one.

## The four context files

Every agent session reads these first (see `CLAUDE.md`):

| File | Purpose |
|---|---|
| `docs/progress.md` | Where we are |
| `docs/decisions.md` | What is already decided (D-001 through D-025) |
| `docs/known-issues.md` | Gotchas and open problems |
| `KYNETIC_CONTEXT.md` | Rules, IDs, D-017 pricing, the two Retell workspaces, Twenty, the portal |

## Layout

| Path | What it is |
|---|---|
| `CLAUDE.md` | Agent instructions and the session protocol. `AGENTS.md` points here |
| `docs/` | The three context docs above, plus counsel notes and the Plan 1 walkthrough (point-in-time) |
| `retell/builds/outbound-speed-to-lead/` | Plan 1: Alex, the Kynetic Roofing demo, the n8n mapping |
| `retell/PROMPTING_STYLE.md` | House style for Retell prompts |
| `retell/builds/emily-speed-to-lead/` | Plan 2 Emily build, paused |
| `retell/builds/kynetic-restoration/` | Kynetic Restoration (Demo). Leave it alone |
| `retell/builds/_inflate-original/` | Reference export of the original build. Leave it alone |
| `tools/retell.py` | Retell API client. Dry-run unless `--apply` |
| `crm/` | Current client CRM and portal (Next.js, portal.kyneticai.com) |
| `.claude/skills/` | `brand-profile`, `demo-profile-generator`, `retell-builder`, `build-log`, `n8n-code-javascript`, `icm-architect` (System map mode only), plus `skills-breakdown.md` |
| `.mcp.json`, `.env.example` | MCP servers and the names of the environment variables |

Legacy material (Vapi prompt, lead-scrape flow, trade-receptionist export, SeldonFrame log) is no longer on main. It is recoverable from tag `archive/pre-reorg-2026-10-17`.

Secrets stay in `.env` (see `.env.example`) or in the cloud environment. Never commit them.

Nora (`agent_4c34644a04c74e27253e80167b`, n8n `2PFWFqBM0wabADk6`) is frozen. New Retell builds go in the `abdullahblitz` workspace. Nora and Emily stay in `kyneticai`.
