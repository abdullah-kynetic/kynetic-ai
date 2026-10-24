---
type: process
status: verified
consumes: [n8n-backup-copy]
produces: [n8n-backup-copy]
verified_on: 2026-10-22
verified_at: 5888b13
---

# backup-n8n

Mirror an n8n instance's workflows into git.

## Input -> Movement -> Output
Input: `N8N_BASE_URL`, `N8N_API_KEY`. Movement: GET all workflows, strip volatile fields, write one JSON per workflow into the bucket the manifest names. Output: changed files and an updated manifest; new ids go to `unsorted/`.

## Why this shape
Deterministic JSON (sorted keys, volatile fields dropped) so a diff means a real change (`n8n_backup.py:32-33`, `:81-82`).

## Steps
1. `python tools/n8n_backup.py --check` first (reports, writes nothing: `:86-88`).
2. Run without `--check`; **files not returned by that n8n are deleted** (`:92-93`).
3. Review the diff (Nora's JSON should not change), place `unsorted/` ids in the manifest, commit.

## If you change this
- **Hits:** [[n8n-backup-copy]], `n8n/README.md`. Switching the target instance rewrites the whole folder.
