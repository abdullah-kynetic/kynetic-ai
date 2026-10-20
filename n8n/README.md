# n8n workflow backups

Git copy of the n8n workflows, so they survive any n8n instance (cloud or self-hosted).

- `workflows/active/`: live or in testing. The only folder imported into self-hosted n8n.
- `workflows/archive/`: kept for reference, never deployed.
- `workflows/unsorted/`: new workflows the manifest has not placed yet.
- `manifest.json`: workflow id to bucket. Edit the bucket to move a workflow, then re-run the tool.

Refresh the copy (read-only against n8n; needs `N8N_BASE_URL` and `N8N_API_KEY` in `.env`):

```bash
python tools/n8n_backup.py          # write files
python tools/n8n_backup.py --check  # exit 1 if this copy is out of date
```

Test data (`pinData`), run state and timestamps are stripped so diffs show real changes only. n8n never exports credential values, so no secrets are stored here. Credentials must be recreated by hand on a new instance (see the self-hosting plan, Twenty task 3.10).

The initial sort (2026-10-18) is provisional: everything active in n8n cloud went to `active/`, everything else to `archive/`. Abdullah decides the final split.
