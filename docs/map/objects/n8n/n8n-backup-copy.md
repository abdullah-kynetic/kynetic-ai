---
type: object
cluster: n8n
universe: live
status: verified
entity: tools/n8n_backup.py
verified_on: 2026-10-22
verified_at: cbb5046 (source files unchanged since 67763e6)
---

# n8n backup copy

`tools/n8n_backup.py` mirrors whatever n8n it is pointed at into `n8n/workflows/{active,archive,unsorted}/` and `n8n/manifest.json`. It only GETs from n8n (`:56`).

## Why this shape
Keyed by workflow id; bucket comes from the manifest, so a human decides what is "active". New ids land in `unsorted` (`:75-78`).

## Shape
- Drops volatile fields and test data (`DROP`, `:34-36`), so no secrets or pinned data are written.
- **It deletes repo files**: any file in the three buckets whose workflow id is not returned by the n8n it queried is `unlink()`ed (`:83-84`, `:92-93`). Pointing `N8N_BASE_URL` at the VPS would remove the cloud copies and write the VPS ones. Git history keeps them. `--check` reports instead of writing (`:86-88`).
- Current contents: 15 active, 37 archive, all from the cloud instance; credentials are names only (`n8n/CREDENTIALS.md`).

## If you change this
- **Hits:** `n8n/README.md`, `n8n/manifest.json`, `.env.example` (`N8N_BASE_URL`, `N8N_API_KEY` now listed), which instance is canonical.
- **Does not hit:** the live workflows (read-only against n8n).

## See
- `tools/n8n_backup.py`, `n8n/README.md`
