# System map of kynetic-ai

A walkable edit map of this repo: what the nouns are, and what else moves if you change one. The repo stays the source of truth; cards cite it and never replace it. Status: slices 1-4 done (catalog, 20 verified object cards, 5 process cards, change index) plus the plans in `../plans/`. Slice 5 (re-verify) pending your read.

## Where to go

| If you want | Open |
|---|---|
| What is X | `objects/_index.md`, then the one card |
| What else moves if I change X | the card's "If you change this", or `effects/CONTEXT.md` |
| How this map works, universes, name collisions | `CONTEXT.md` |
| What may not be touched | `CONTEXT.md` "No-touch", `../../KYNETIC_CONTEXT.md` |
| The portal build-out plan (Twenty sync, onboarding, proposals) | `../plans/PORTAL-BUILDOUT.md` |
| Repo rules and session protocol | `../../CLAUDE.md` |

## Name collisions (product word = file or system name)

- **Alex** = the Plan 1 outbound speed-to-lead voice agent = Retell agent in workspace `abdullahblitz` = spec in `retell/builds/outbound-speed-to-lead/`. "Speed to lead" always means this outbound agent, not Emily.
- **Outbound Speed to Lead** = n8n workflow of that name. Same name exists as cloud copy (`m2YJwZ1l8DTzyEkw`, leftover) and VPS copy (`tXJwNTkNgKGnp0Ab`, canonical per Abdullah 2026-10-21, unverified in repo).
- **Lead** = Twenty object `endCustomer`. **Call** = Twenty object `customerInteraction` (field `retellCallId` also stores an 11Labs conversation id).
- **Kynetic Roofing** = fictional demo skin built on AM-1 Roofing's real profile. **Kynetic Restoration (Demo)** = protected Plan 2 demo client (Nora's world). Different things.
- **Nora** = the Kynetic Restoration (Demo) build: same Retell agent and n8n workflow ids (`retell/builds/kynetic-restoration/build-ids.md`). **Emily** = paused build copy. Both are Plan 2 inbound receptionists, not Plan 1.
- **Bake-off** and **lead sourcing** are separate clusters that run in parallel to Plan 1.
- **Retell workspaces**: `abdullahblitz` (new builds, Alex) vs `kyneticai` (Nora, Emily).

## Universes

live = in force. leftover = present, not the main path. ghost = named but not wired.

Twins of this file (`AGENTS.md`, `routing.md`) must stay byte-identical. Regenerate by copying; never hand-edit.
