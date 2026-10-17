---
name: retell-builder
description: Build or update a Kynetic Retell voice agent (Plan 1 outbound speed-to-lead) with tools/retell.py. Use for "build a voice agent", "set up Retell", "create or change the Alex outbound agent", or preparing a voice agent for a new client. Writes are dry-run first; --apply only after Abdullah approves that specific change.
---

# Retell Voice Agent Builder

Layer: build. The current build is Plan 1, the outbound speed-to-lead agent (Alex, Kynetic Roofing demo). Rules, IDs and the two Retell workspaces are in `KYNETIC_CONTEXT.md`; read it first.

## Hard rules

- Tell Abdullah the exact change and wait for a yes before any Retell, n8n or Twenty change. Dry-run output is how you show it.
- Never add, remove, rename, disable or change parameters of an agent tool without approval of that specific change. A tool that looks wrong gets a recommendation, not a fix.
- Nora is frozen. Do not edit Kynetic Restoration (Demo). New builds go in the `abdullahblitz` workspace; Nora and Emily stay in `kyneticai`.
- Claude never configures n8n for a build. It produces what n8n needs (see `N8N_MAPPING.md`) and Abdullah wires it.

## Files

| File | Use |
|---|---|
| `tools/retell.py` | The only Retell client. Dry-run unless `--apply` |
| `retell/PROMPTING_STYLE.md` | House style for prompts |
| `retell/builds/outbound-speed-to-lead/PROMPT.md` | The Alex prompt (source of truth) |
| `retell/builds/outbound-speed-to-lead/agent.config.json` | Agent and LLM config used by `create-outbound` |
| `retell/builds/outbound-speed-to-lead/FORM_SPEC.md`, `N8N_MAPPING.md`, `BUILD_PLAN.md` | Intake form, n8n wiring, plan |
| `retell/builds/outbound-speed-to-lead/demo-business/` | Demo business profile and knowledge base |

## Steps

1. **Inputs.** Business name, niche, owner/transfer phone, timezone, Cal.com event type, agent name. If a brand profile exists for the client (see the `brand-profile` skill), read it first. Ask for missing items in one message.
2. **Prompt.** Start from `PROMPT.md` and `PROMPTING_STYLE.md`. For a new client, work in a sibling folder `retell/builds/<client-slug>/` copied from the outbound folder (the per-client template, task 3.7, is not built yet). Do not put another client's facts into the Kynetic Roofing demo files. Keep the D-011 AI and recording disclosure in the opener.
3. **Dry run.** `python tools/retell.py create-outbound <config.json>` prints the LLM and agent it would create. Show Abdullah the output.
4. **Apply.** Only after a yes: rerun with `--apply`, then record the new agent ID and LLM ID in `KYNETIC_CONTEXT.md` and `docs/progress.md`.
5. **Verify.** `python tools/retell.py get-agent <agent_id>` and `get-llm <llm_id>`. Keep a copy with `snapshot <agent_id> <out_dir>`.
6. **Hand off to n8n.** Give Abdullah the agent ID, the post-call webhook path and any placeholders from `N8N_MAPPING.md`. `set-agent-webhook <agent_id> <url> [--apply]` sets the agent's post-call URL once he supplies it.
7. **Test order.** Web call first, a test submission second, a real phone call last (outbound identity verification via Persona must be done first).

## Error handling

- API shape changed or a call fails: read the HTTP error `tools/retell.py` prints, then check the Retell docs for the current field names before retrying.
- Missing Cal.com key or event type: do not strip the Cal tools; ask Abdullah. Cal tools are native Retell tools (D-014).
- The Retell MCP is optional: it runs through npx but needs Deno. Prefer `tools/retell.py`.
