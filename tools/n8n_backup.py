#!/usr/bin/env python3
"""Back up n8n workflows to git (read-only against n8n).

Reads N8N_BASE_URL and N8N_API_KEY from the environment or a .env file in the
repo root. Standard library only. It only ever GETs from n8n.

Each workflow is saved as n8n/workflows/<bucket>/<slug>__<id>.json with test data
(pinData), run state (staticData) and volatile fields removed, so a re-run only
produces a diff when the workflow really changed. Credentials are never exported
by n8n (nodes only name them), so no secrets land in git.

Buckets come from n8n/manifest.json (id -> bucket):
  active   : live or in testing. The only bucket deployed to self-hosted n8n.
  archive  : saved for reference, never deployed.
New workflows not in the manifest go to unsorted/ and are listed in the output.
Move a file's id between buckets by editing the manifest, then re-run.

Usage:
  python tools/n8n_backup.py            # write files
  python tools/n8n_backup.py --check    # exit 1 if the repo copy is out of date
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "n8n" / "workflows"
MANIFEST = ROOT / "n8n" / "manifest.json"
DROP = {"pinData", "staticData", "updatedAt", "createdAt", "versionId", "activeVersionId",
        "activeVersion", "shared", "tags", "isArchived", "triggerCount", "meta", "homeProject"}
BUCKETS = ("active", "archive", "unsorted")


def load_env():
    env = dict(os.environ)
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip("\"'"))
    return env


def fetch_all(env):
    base = env["N8N_BASE_URL"].rstrip("/")
    if not base.endswith("/api/v1"):
        base += "/api/v1"
    rows, cursor = [], None
    while True:
        url = f"{base}/workflows?limit=250" + (f"&cursor={cursor}" if cursor else "")
        req = urllib.request.Request(url, headers={"X-N8N-API-KEY": env["N8N_API_KEY"]})
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)
        rows += d["data"]
        cursor = d.get("nextCursor")
        if not cursor:
            return rows


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:50] or "workflow"


def main():
    check = "--check" in sys.argv
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    wfs = fetch_all(load_env())
    want, new = {}, []
    for w in wfs:
        entry = manifest.get(w["id"])
        if entry is None:
            entry = {"name": w["name"], "bucket": "unsorted"}
            manifest[w["id"]] = entry
            new.append(w["name"])
        entry["name"] = w["name"]
        data = {k: v for k, v in w.items() if k not in DROP}
        want[OUT / entry["bucket"] / f"{slug(w['name'])}__{w['id']}.json"] = (
            json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
    have = {p for b in BUCKETS for p in (OUT / b).glob("*.json")}
    stale = have - set(want)
    changed = [p for p, s in want.items() if not p.exists() or p.read_text() != s]
    if check:
        print(f"{len(changed)} changed/new, {len(stale)} stale, {len(new)} unsorted-new")
        sys.exit(1 if changed or stale or new else 0)
    for p, s in want.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(s)
    for p in stale:
        p.unlink()
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items(), key=lambda x: x[1]["name"].lower())),
                                   indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(want)} workflows, {len(changed)} changed, {len(stale)} removed")
    for n in new:
        print(f"  NEW (unsorted): {n}")


if __name__ == "__main__":
    main()
