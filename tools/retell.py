#!/usr/bin/env python3
"""Retell API tool for Kynetic AI (replaces the Deno-dependent Retell MCP).

Reads RETELL_API_KEY from the environment or a .env file in the repo root.
Standard library only, so it runs locally and in Claude Code cloud sessions.

Every write is a DRY RUN unless --apply is passed. Agent tool definitions are
core product features: on existing agents the only tool change this script can make is swapping
a custom tool's webhook URL (it verifies nothing else changed). `create-outbound` builds a NEW
agent and LLM with its own tools and never edits an existing one.

Usage:
  python tools/retell.py get-agent <agent_id>
  python tools/retell.py get-llm <llm_id>
  python tools/retell.py snapshot <agent_id> <out_dir>
  python tools/retell.py rename-agent <agent_id> "<name>" [--apply]
  python tools/retell.py set-begin-message <llm_id> "<text>" [--apply]
  python tools/retell.py set-agent-webhook <agent_id> <url> [--apply]
  python tools/retell.py repoint-tools <llm_id> <old_url_or_id>=<new_url_or_id> ... [--apply]
  python tools/retell.py create-outbound [config.json] [--apply]
"""
import copy
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.retellai.com"
REDACT_KEYS = {"cal_api_key"}


def load_key():
    if os.environ.get("RETELL_API_KEY"):
        return os.environ["RETELL_API_KEY"]
    env = Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("RETELL_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("RETELL_API_KEY not set (export it, or add it to .env)")


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {load_key()}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Retell {method} {path} failed: {e.code} {e.read().decode()[:500]}")


def redact(obj):
    obj = copy.deepcopy(obj)
    for t in obj.get("general_tools", []) or []:
        for k in REDACT_KEYS & t.keys():
            t[k] = "${CAL_API_KEY}"
    return obj


def show(obj):
    print(json.dumps(redact(obj), indent=2))


def write(method, path, body, apply):
    print(f"{'APPLY' if apply else 'DRY RUN'}: {method} {path}\n{json.dumps(body, indent=2)[:3000]}")
    if not apply:
        print("\nNothing sent. Re-run with --apply after Abdullah approves this change.")
        return None
    return call(method, path, body)


def repoint_tools(llm_id, pairs, apply):
    llm = call("GET", f"/get-retell-llm/{llm_id}")
    before = llm.get("general_tools") or []
    after = copy.deepcopy(before)
    changed = []
    for t in after:
        url = t.get("url")
        if not url:
            continue
        for old, new in pairs:
            if url == old or url.endswith("/" + old):
                t["url"] = new if new.startswith("http") else url[: -len(old)] + new
                changed.append((t["name"], url, t["url"]))
    for a, b in zip(before, after):
        a2, b2 = dict(a), dict(b)
        a2.pop("url", None)
        b2.pop("url", None)
        if a2 != b2:
            sys.exit(f"Refusing: tool {a['name']} would change beyond its URL")
    if not changed:
        sys.exit("No tool URLs matched; nothing to do")
    for name, old, new in changed:
        print(f"{name}: {old}\n  -> {new}")
    if not apply:
        print("\nDRY RUN: nothing sent. Re-run with --apply after Abdullah approves this change.")
        return
    res = call("PATCH", f"/update-retell-llm/{llm_id}", {"general_tools": after})
    for t in res.get("general_tools", []):
        if t.get("url"):
            print("now:", t["name"], t["url"])


OUTBOUND_DIR = Path(__file__).resolve().parent.parent / "retell" / "builds" / "outbound-speed-to-lead"


def read_prompt(prompt_md):
    """Return the first fenced block of PROMPT.md that starts with '# Role'."""
    text = Path(prompt_md).read_text()
    parts = text.split("```")
    for block in parts[1::2]:
        if block.lstrip().startswith("# Role"):
            return block.strip()
    sys.exit(f"No fenced '# Role' block found in {prompt_md}")


def build_outbound(config):
    cal_key = os.environ.get("CAL_API_KEY")
    if not cal_key:
        sys.exit("CAL_API_KEY not set (needed for the Cal.com tools)")
    cal = config["cal"]
    tools = [
        {
            "type": "check_availability_cal",
            "name": "check_availability_cal",
            "description": "Check the Roof Inspection calendar for open slots. ALWAYS query a specific date.",
            "cal_api_key": cal_key,
            "event_type_id": cal["event_type_id"],
            "timezone": cal["timezone"],
            "speak_after_execution": True,
        },
        {
            "type": "book_appointment_cal",
            "name": "book_appointment_cal",
            "description": "Book the roof inspection on the calendar at the chosen date and time.",
            "cal_api_key": cal_key,
            "event_type_id": cal["event_type_id"],
            "timezone": cal["timezone"],
            "location_type": "attendeeAddress",
            "speak_after_execution": True,
            "cal_fields": [
                {"name": "name", "type": "string", "required": True, "description": "attendee name"},
                {"name": "email", "type": "string", "required": True, "description": "attendee email"},
                {"name": "location", "type": "string", "required": True, "description": "property address where the inspection will happen"},
                {"name": "notes", "type": "string", "required": False, "description": "short note on the roof issue"},
            ],
        },
        {"type": "end_call", "name": "end_call", "description": "End the call.", "speak_after_execution": True},
    ]
    llm = dict(config["llm"])
    llm["general_prompt"] = read_prompt(OUTBOUND_DIR / "PROMPT.md")
    llm["general_tools"] = tools
    return llm


def create_outbound(config_path, apply):
    config = json.loads(Path(config_path).read_text())
    llm_body = build_outbound(config)
    name = config["agent"]["agent_name"]
    print("LLM payload (Cal key redacted):")
    print(json.dumps(redact(llm_body), indent=2)[:6000])
    agent_preview = dict(config["agent"])
    agent_preview["response_engine"] = {"type": "retell-llm", "llm_id": "<new llm id>"}
    print("\nAgent payload:")
    print(json.dumps(agent_preview, indent=2))
    if not apply:
        print("\nDRY RUN: nothing sent. Re-run with --apply after Abdullah approves. "
              "Creates a new, UNPUBLISHED agent and LLM; no phone number is attached.")
        return
    existing = call("GET", "/list-agents")
    if any(a.get("agent_name") == name for a in existing):
        sys.exit(f"Refusing: an agent named '{name}' already exists")
    llm = call("POST", "/create-retell-llm", llm_body)
    agent_body = dict(config["agent"])
    agent_body["response_engine"] = {"type": "retell-llm", "llm_id": llm["llm_id"]}
    agent = call("POST", "/create-agent", agent_body)
    print(f"\nCreated LLM {llm['llm_id']} and agent {agent['agent_id']} (unpublished, no phone number).")


def main():
    args = [a for a in sys.argv[1:] if a != "--apply"]
    apply = "--apply" in sys.argv
    if not args:
        sys.exit(__doc__)
    cmd, rest = args[0], args[1:]
    if cmd == "get-agent":
        show(call("GET", f"/get-agent/{rest[0]}"))
    elif cmd == "get-llm":
        show(call("GET", f"/get-retell-llm/{rest[0]}"))
    elif cmd == "snapshot":
        agent = call("GET", f"/get-agent/{rest[0]}")
        out = Path(rest[1])
        out.mkdir(parents=True, exist_ok=True)
        (out / "agent.json").write_text(json.dumps(agent, indent=2))
        llm_id = (agent.get("response_engine") or {}).get("llm_id")
        if llm_id:
            (out / "llm.json").write_text(json.dumps(redact(call("GET", f"/get-retell-llm/{llm_id}")), indent=2))
        print(f"Saved snapshot of {rest[0]} to {out} (Cal keys redacted)")
    elif cmd == "rename-agent":
        write("PATCH", f"/update-agent/{rest[0]}", {"agent_name": rest[1]}, apply)
    elif cmd == "set-begin-message":
        write("PATCH", f"/update-retell-llm/{rest[0]}", {"begin_message": rest[1]}, apply)
    elif cmd == "set-agent-webhook":
        write("PATCH", f"/update-agent/{rest[0]}", {"webhook_url": rest[1]}, apply)
    elif cmd == "repoint-tools":
        repoint_tools(rest[0], [p.split("=", 1) for p in rest[1:]], apply)
    elif cmd == "create-outbound":
        create_outbound(rest[0] if rest else OUTBOUND_DIR / "agent.config.json", apply)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
