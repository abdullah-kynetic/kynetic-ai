# skills: repo-local Claude skills

One job: route a task to a skill. Trigger table: `skills-breakdown.md`.

## Rules
- `retell-builder` drives `tools/retell.py` (dry-run first). `build-log` is the only skill that writes `docs/*`.
- `icm-architect` is for System map mode only here. Never Restructure mode; never move or delete files without a yes.
- `brand-profile` and `demo-profile-generator` need `tools/gbp_scrape.py`, which is not in the repo (known gap).
- Adding or removing a skill: update `skills-breakdown.md` and the `README.md` layout row.
