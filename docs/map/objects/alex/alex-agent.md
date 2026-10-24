---
type: object
cluster: alex
universe: live
status: verified
entity: retell/builds/outbound-speed-to-lead/
verified_on: 2026-10-22
verified_at: cbb5046 (source files unchanged since 67763e6)
---

# Alex (the Plan 1 outbound agent)

The Retell agent "Outbound Speed to Lead (Kynetic Roofing demo)", called Alex. The repo holds its spec, not the live agent.

## Why this shape
`create-outbound` builds a new LLM and agent from three inputs and refuses if the agent name already exists (`tools/retell.py:178-179`), so the repo can create Alex but never edit it.

## Shape
- Prompt: first fenced block of `PROMPT.md` that starts with `# Role` (fence at `PROMPT.md:9` and `:134`, heading `:10`). `read_prompt` returns only that block (`tools/retell.py:114-121`). Text outside the fence is never sent.
- Config: `agent.config.json` gives llm (gpt-4.1, agent speaks first), Cal event `7404470` + timezone `America/Los_Angeles`, voice `11labs-Cimo`, 600000 ms cap, voicemail = hang up.
- Tools are hard-coded in `build_outbound`: `check_availability_cal`, `book_appointment_cal` (name, email, location, notes), `end_call` (`tools/retell.py:129-156`). The Cal key comes from env `CAL_API_KEY` only and is embedded in the tool at creation.
- Live ids (agent, LLM, workspace `abdullahblitz`): `KYNETIC_CONTEXT.md`. Prompt v1.2.3 is on `claude/alex-demo-live-test`, not main.

## Connected to
- **owned-by:** none; spec files are plain.
- **joins:** [[outbound-speed-to-lead-workflow]] (holds agent id and from-number), [[retell-client]].
- **looks-like-but-is-not:** Nora, Emily, the Restoration demo, and the "Alex Lab" control agent.

## If you change this
- **Hits:** `PROMPT.md` must keep exactly one `# Role` fenced block or `create-outbound` exits. Prompt text edits change nothing live until someone creates/updates the agent. `N8N_MAPPING.md`, `FORM_SPEC.md` (variables the workflow passes), `docs/progress.md` (version note).
- **Does not hit:** the workflow (it only needs the agent id), Twenty.
- **Outside the tree:** the live agent in Retell, the Cal event.

## See
- `tools/retell.py`, `retell/builds/outbound-speed-to-lead/agent.config.json`
