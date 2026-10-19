#!/usr/bin/env python3
"""Import the n8n/workflows/active backups into the SELF-HOSTED n8n, always INACTIVE.

Reads N8N_SELF_BASE_URL and N8N_SELF_API_KEY from the environment or a .env file in the repo root.
Standard library only. Dry run unless --apply is passed. It only creates workflows that do not
already exist by name, never activates anything, and never touches n8n cloud.

Credentials are not part of the backups: after import, every node that needs one shows a missing
credential until it is recreated by hand in the self-hosted editor.

Usage:
  python tools/n8n_import.py [--bucket active] [--apply]
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SETTINGS_OK = {"executionOrder", "timezone", "saveDataErrorExecution", "saveDataSuccessExecution",
               "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow",
               "callerPolicy", "callerIds", "timeSavedPerExecution", "availableInMCP"}


def load_env():
    env = dict(os.environ)
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip("\"'"))
    return env


def call(env, method, path, body=None):
    base = env["N8N_SELF_BASE_URL"].rstrip("/") + "/api/v1"
    req = urllib.request.Request(base + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-N8N-API-KEY": env["N8N_SELF_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    apply = "--apply" in sys.argv
    bucket = sys.argv[sys.argv.index("--bucket") + 1] if "--bucket" in sys.argv else "active"
    env = load_env()
    have = {w["name"] for w in call(env, "GET", "/workflows?limit=250")["data"]}
    for f in sorted((ROOT / "n8n" / "workflows" / bucket).glob("*.json")):
        w = json.loads(f.read_text())
        if w["name"] in have:
            print(f"skip (exists): {w['name']}")
            continue
        body = {"name": w["name"], "nodes": w["nodes"], "connections": w["connections"],
                "settings": {k: v for k, v in (w.get("settings") or {}).items() if k in SETTINGS_OK}}
        if apply:
            r = call(env, "POST", "/workflows", body)
            print(f"created inactive: {w['name']} -> {r['id']} (active={r['active']})")
        else:
            print(f"would create inactive: {w['name']}")
    if not apply:
        print("dry run; add --apply to create")


if __name__ == "__main__":
    main()
