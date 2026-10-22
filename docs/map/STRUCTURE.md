# The ICM structure: what it prescribes, why, what our repo looks like, and how we keep it true

## 1. What icm-architect prescribes for a repo ("System map" form)

From the skill (`.claude/skills/icm-architect/references/system-map.md`). The subject keeps its own tree; the map sits beside its existing docs:

```
<repo>/
├─ CLAUDE.md                  existing entry file: add ONE row pointing at the map
└─ docs/ (or developer-docs/)
   └─ map/
      ├─ CLAUDE.md            L0 catalog: where to go, name collisions, universes
      ├─ AGENTS.md            byte-identical twin (for tools that ignore CLAUDE.md)
      ├─ routing.md           byte-identical twin
      ├─ CONTEXT.md           how to walk it; rules; no-touch list
      ├─ _meta/schema.md      closed list of card types and their labels
      ├─ _templates/          object.md, process.md  (new cards are copies)
      ├─ objects/
      │  ├─ CONTEXT.md
      │  ├─ _index.md         one line per noun: stub | verified | stale
      │  └─ <cluster>/<noun>.md   one card per noun
      ├─ processes/<verb>.md  only movements that really run
      └─ effects/CONTEXT.md   "if you change X, open these cards"
```

Plus the ten invariants (one folder one job; a small stable entry file under ~60 lines; a CONTEXT.md per working folder with inputs, process, outputs and a human check; factory vs product; every output an edit surface; load only what the step needs; plain text; the filesystem is the state; instantiate by copying).

## 2. Why it is shaped like that (not slop)

| Piece | The problem it solves | What goes wrong without it |
|---|---|---|
| Small root `CLAUDE.md` that only routes | An agent has about 60 lines to learn where it is and where to go | The entry file becomes a dumping ground; every session loads thousands of irrelevant tokens and misses the one rule that mattered |
| A `CONTEXT.md` in each working folder | Says what this folder reads, writes, which live system it touches, and what a human checks | Agents guess. This repo's own risk: `tools/retell.py` can write to Nora; nothing in the folder said so until the contract did |
| Cards for nouns, with "Hits / Does not hit" | Answers "what else moves if I change X" in one read | Changing a Twenty field silently breaks a workflow whose JSON holds the field name as a string; nobody connects the two |
| Universes (live / leftover / ghost) | Stops agents from implementing against dead things | The cloud n8n copy, the Vapi workflows and the unmerged bake-off all look real in a file listing |
| Name-collision table | One product word, several files and systems (Alex, Nora, "lead") | Two sessions mean different things by the same word |
| `verified_on` + `verified_at` + citations | Makes a card checkable and expirable | Confident wrong cards are worse than no cards; a date and a commit let a script detect staleness |
| Byte-identical twins | Tools read different entry files | Two hand-edited copies drift (the skill calls this out as a top failure) |
| The index is the catalog; cards are shelves | You load one line, then one card | Loading everything "to be safe" is the context-stuffing the method exists to prevent |
| No empty `processes/` or `effects/` | Structure only where something exists | Speculative folders rot; three real shelves beat seven imagined ones |
| Repo stays the source of truth | Cards cite files, never replace them | A second spec that disagrees with the code |

The ladder in the skill matters: don't build structure for things done twice. Our 5 processes (lead-to-call, change-alex, backup-n8n, deploy-portal, end-of-session docs) are the ones that actually repeat.

## 3. What our repo looks like once this branch is merged

New or changed files only are marked. Everything else stays where it is; nothing was moved or renamed.

```
kynetic-ai/
├─ CLAUDE.md                          CHANGED  44 -> 38 lines, a router with the same hard rules
├─ AGENTS.md                          unchanged (pointer)
├─ KYNETIC_CONTEXT.md                 CHANGED  go-live line corrected
├─ README.md                          CHANGED  D-001..D-022, lists icm-architect
├─ .env.example                       CHANGED  adds N8N_BASE_URL, N8N_API_KEY (names only)
├─ .mcp.json, .gitignore              unchanged
├─ .claude/
│  ├─ settings.json                   unchanged (allowlist change still waiting for your yes)
│  └─ skills/
│     ├─ CONTEXT.md                   NEW
│     ├─ skills-breakdown.md          CHANGED  rows for icm-architect, map-audit
│     ├─ icm-architect/               NEW  (15 markdown files from RinDig/icm-architect, MIT)
│     ├─ map-audit/SKILL.md           NEW  weekly audit skill
│     └─ brand-profile, build-log, demo-profile-generator, n8n-code-javascript, retell-builder   unchanged
├─ docs/
│  ├─ CONTEXT.md                      NEW
│  ├─ progress.md                     CHANGED  one stale DNS line
│  ├─ decisions.md, known-issues.md, plan1-walkthrough.md, counsel-*.md   unchanged
│  ├─ icm/system-map-proposal.md      NEW  the audit and original proposal (history; could be archived once adopted)
│  └─ map/                            NEW
│     ├─ CLAUDE.md  AGENTS.md  routing.md   catalog + two exact twins
│     ├─ CONTEXT.md  STRUCTURE.md           how to walk it; this file
│     ├─ _meta/schema.md   _templates/{object,process}.md
│     ├─ objects/_index.md  objects/CONTEXT.md
│     ├─ objects/alex/        alex-agent, alex-prompt, alex-form-spec
│     ├─ objects/lead/        outbound-speed-to-lead-workflow, twenty-lead-objects, pricing-d017
│     ├─ objects/n8n/         n8n-backup-copy
│     ├─ objects/retell/      retell-client, retell-agent-tools, retell-allowlist
│     ├─ objects/bakeoff/     bakeoff-summary
│     ├─ objects/leadsourcing/ lead-engine
│     ├─ objects/portal/      portal-ingest-api, portal-tenancy-rls, portal-auth, portal-files-storage, portal-deploy
│     ├─ objects/docs/        context-docs-mirror
│     ├─ objects/tooling/     repo-skills, mcp-config
│     ├─ processes/           lead-to-call, change-alex, backup-n8n, deploy-portal, end-of-session-docs
│     ├─ effects/CONTEXT.md   "if you change X, open these"
│  ├─ plans/                          NEW  AUDIT.md, PLAN1-REMAINING.md, PORTAL-BUILDOUT.md (plans, not map cards)
├─ n8n/
│  ├─ CONTEXT.md                      NEW
│  └─ README.md, CREDENTIALS.md, manifest.json, data-tables/, workflows/{active,archive}/   unchanged
├─ retell/
│  ├─ CONTEXT.md                      NEW
│  ├─ PROMPTING_STYLE.md              unchanged
│  └─ builds/
│     ├─ outbound-speed-to-lead/      NEW CONTEXT.md; PROMPT.md, agent.config.json, BUILD_PLAN.md, FORM_SPEC.md, N8N_MAPPING.md, demo-business/ unchanged
│     └─ emily-speed-to-lead/, kynetic-restoration/, _inflate-original/    unchanged (no-touch)
├─ tools/
│  ├─ CONTEXT.md                      NEW
│  ├─ retell.py, n8n_backup.py        unchanged
│  └─ map_check.py                    NEW  read-only drift checker
└─ portal/
   ├─ CONTEXT.md                      NEW
   └─ everything else unchanged (src/, tests/, drizzle/, deploy/, ADMIN.md, N8N.md, ...)
```

The three plan files live in `docs/plans/` (moved from `docs/map/` on 2026-10-22 with Abdullah's approval).

## 4. Keeping it true

A map only helps while it is true. Four layers, cheapest first:

1. **`python tools/map_check.py`** (built, read-only, no network). It checks: the three entry files are identical; every double-bracket link resolves; every card is in the index; every cited path exists; **a card is STALE when files under its entity changed in git after the commit it was verified at**; README's decision range matches `decisions.md`; no top-level folder lacks a `CONTEXT.md`; docs that say a branch is "not merged" when it is; remote branches already merged (safe to delete) and unmerged branches idle 30+ days. Exit code 1 on any problem. I tested it by breaking a twin and the README range: both were caught.
2. **Skill `map-audit`** (written). Runs the script, then does the part a script cannot: reads open Twenty tasks (GET only) and compares them with `docs/progress.md` to catch finished work that was never recorded, past-due dates still TODO, tasks missing from the docs, and counts or ids that disagree across files. Reports problems first, proposes edits, applies nothing without a yes.
3. **A schedule.** Options: a weekly Claude scheduled task or routine that runs `map-audit` and posts the report; or a GitHub Action running `map_check.py` on every pull request (no `.github/` exists today). Both are standing configuration, so each needs your explicit yes. Any agent that can run Python (Claude Code, another coding agent, a bot on the VPS via cron) can run the script, because it is plain stdlib Python with no keys; I have not tested other tools.
4. **Habit at the end of every session:** the `build-log` skill already updates the three docs; add one line to it to run `map_check.py` and refresh any STALE card it names. The map then moves with the work instead of being a project.

What it will catch on day one that nobody has noticed: the 28 remote branches already merged into `main`, and (after you ping it) the cloud-versus-VPS id mismatch once `KYNETIC_CONTEXT.md` is updated.

What it cannot catch: whether the live Retell agent, the live n8n instance or Twenty match the repo. For that, `map-audit` step 5 checks ids with read-only list calls, and `tools/n8n_backup.py --check` compares the n8n copy to the repo (read-only, needs `N8N_BASE_URL` and `N8N_API_KEY`; point it at the VPS only after fixing its delete behavior, AUDIT.md #3).
