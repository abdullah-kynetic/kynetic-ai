# retell: voice agent builds and prompt style

One job: hold the specs for Retell voice agents. The live agents are in Retell, not here.

## Map
- `builds/outbound-speed-to-lead/`: Plan 1 Alex (live spec). Start at `BUILD_PLAN.md` "Current state".
- `builds/emily-speed-to-lead/`: Plan 2 Emily, paused.
- `builds/kynetic-restoration/`: protected demo IDs. Do not edit.
- `builds/_inflate-original/`: reference export. Leave alone.
- `PROMPTING_STYLE.md`: house style for any prompt.

## Rules
- Two Retell workspaces: `abdullahblitz` (new builds, Alex) and `kyneticai` (Nora, Emily). IDs: `KYNETIC_CONTEXT.md`.
- Repo files are specs. Changing one changes nothing live. Live changes go through `tools/retell.py` dry-run, then a yes.
- Never add, remove, rename or change parameters of an agent tool without approval of that change.
- Never touch Nora, Emily, or the Kynetic Restoration (Demo) build.

## Human check
Compare the prompt version in `PROMPT.md` with the version recorded in `docs/progress.md` before saying what is live.
