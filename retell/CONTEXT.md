# retell: voice agent builds and prompt style

> Parked track for Alex. Current Alex platform is ElevenLabs through n8n on the VPS (`docs/STATUS.md`). Do not change or invoke live Alex `agent_8201m5afn2rbeb7v29xfkhh1pjef`. Nora, Emily, and Kynetic Restoration (Demo) stay protected.

One job: hold the specs for Retell voice agents. The Retell agents are in Retell, not here.

## Map
- `builds/outbound-speed-to-lead/`: parked Retell Alex spec. Its "Current state" is an Oct 17 snapshot, not the current platform.
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
