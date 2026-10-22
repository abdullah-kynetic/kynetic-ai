# n8n: git copy of the workflows

One job: keep a restorable copy of the n8n workflows. This folder is not the live system.

## Inputs
- Working: n8n API, through `python tools/n8n_backup.py` (read-only).
- Reference: `manifest.json` (id to bucket), `CREDENTIALS.md` (credential names only).

## Outputs
- `workflows/active/` live or in testing. `workflows/archive/` reference only, never deployed. `workflows/unsorted/` new, not yet placed.

## Rules
- Bucket split is provisional (see README). Abdullah decides the final split.
- `active/` is the folder that would be imported to a self-hosted n8n. It currently includes Nora (`2PFWFqBM0wabADk6`): do not import or edit it without a yes.
- Which n8n instance is canonical is an open question; see `docs/icm/system-map-proposal.md` section 6.
- No secrets are stored; credentials are recreated by hand on a new instance.

## Human check
Run `python tools/n8n_backup.py --check`; review the diff before committing. Expect Nora's file to change only if Nora changed in n8n.
