#!/usr/bin/env python3
"""Read-only ElevenLabs conversation puller and bake-off scorer for Kynetic AI.

Reads ELEVENLABS_API_KEY_blitz (or the variable named by --key-env) from the
environment or a .env file in the repo root. Standard library only. It never
writes to ElevenLabs: every request is a GET.

Usage:
  python tools/elevenlabs_conv.py list <agent_id> [--since 2026-10-20] [--key-env NAME]
  python tools/elevenlabs_conv.py score <conversation_id> [--key-env NAME] [--save DIR]

`score` prints a RESULTS.md row plus the evidence behind it: stacked-question turns,
response delays, every tool call and result, false "all set" checks, duration and
billed cost. Field paths follow the ElevenLabs conversation payload as last seen;
anything missing prints as "n/a" instead of a guess.
"""
import json
import os
import re
import statistics
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://api.elevenlabs.io"
SUCCESS_PHRASES = ("you're all set", "you are all set", "you're booked", "you are booked")


def arg(flag, default=None):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


def load_key(name):
    if os.environ.get(name):
        return os.environ[name]
    env = Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{name} not set (export it, or add it to .env)")


def get(path, key):
    req = urllib.request.Request(API + path, headers={"xi-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs GET {path} failed: {e.code} {e.read().decode()[:300]}")


def cmd_list(agent_id, key):
    since = arg("--since")
    after = int(datetime.fromisoformat(since).replace(tzinfo=timezone.utc).timestamp()) if since else None
    cursor, rows = None, []
    while True:
        q = f"/v1/convai/conversations?agent_id={agent_id}&page_size=100"
        if after:
            q += f"&call_start_after_unix={after}"
        if cursor:
            q += f"&cursor={cursor}"
        page = get(q, key)
        rows += page.get("conversations", [])
        cursor = page.get("next_cursor")
        if not page.get("has_more") or not cursor:
            break
    for c in rows:
        start = c.get("start_time_unix_secs")
        when = datetime.fromtimestamp(start, timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if start else "n/a"
        print(f"{c.get('conversation_id')}  {when}  {c.get('call_duration_secs', 'n/a')}s  "
              f"{c.get('status', '')}  {c.get('call_successful', '')}")
    print(f"{len(rows)} conversation(s)")


def questions_in(text):
    # A turn counts as stacked when it holds two or more question marks.
    return len(re.findall(r"\?", text or ""))


def turn_delay(turn):
    m = (turn.get("conversation_turn_metrics") or {}).get("metrics") or {}
    for k in ("convai_tts_service_ttfb", "convai_llm_service_ttfb"):
        v = (m.get(k) or {}).get("elapsed_time")
        if isinstance(v, (int, float)):
            return v
    return None


def cmd_score(conv_id, key):
    c = get(f"/v1/convai/conversations/{conv_id}", key)
    save = arg("--save")
    if save:
        Path(save).mkdir(parents=True, exist_ok=True)
        (Path(save) / f"{conv_id}.json").write_text(json.dumps(c, indent=2))

    transcript = c.get("transcript") or []
    agent_turns = [t for t in transcript if t.get("role") == "agent" and (t.get("message") or "").strip()]
    stacked = [t for t in agent_turns if questions_in(t.get("message")) >= 2]

    delays = [d for d in (turn_delay(t) for t in agent_turns) if d is not None]
    if not delays:
        # Fallback: gap between a user turn and the next agent turn, by transcript timestamps.
        for prev, cur in zip(transcript, transcript[1:]):
            if prev.get("role") == "user" and cur.get("role") == "agent":
                a, b = prev.get("time_in_call_secs"), cur.get("time_in_call_secs")
                if isinstance(a, (int, float)) and isinstance(b, (int, float)) and b >= a:
                    delays.append(b - a)

    booked, first_success_at, booking_ok_at, tool_log = False, None, None, []
    for i, t in enumerate(transcript):
        for call in t.get("tool_calls") or []:
            tool_log.append(f"turn {i} CALL {call.get('tool_name')} {str(call.get('params_as_json'))[:200]}")
        for res in t.get("tool_results") or []:
            err = res.get("is_error")
            tool_log.append(f"turn {i} RESULT {res.get('tool_name')} error={err} {str(res.get('result_value'))[:200]}")
            if "booking" in (res.get("tool_name") or "") and not err:
                booked = True
                booking_ok_at = booking_ok_at if booking_ok_at is not None else i
        msg = (t.get("message") or "").lower()
        if t.get("role") == "agent" and first_success_at is None and any(p in msg for p in SUCCESS_PHRASES):
            first_success_at = i
    false_success = first_success_at is not None and (booking_ok_at is None or first_success_at < booking_ok_at)

    meta = c.get("metadata") or {}
    dur = meta.get("call_duration_secs")
    cost = meta.get("cost")
    med = f"{statistics.median(delays):.2f} s" if delays else "n/a"
    worst = f"{max(delays):.2f} s" if delays else "n/a"

    print(f"Conversation {conv_id}  agent {c.get('agent_id')}  status {c.get('status')}")
    print(f"Duration {dur if dur is not None else 'n/a'} s  billed cost {cost if cost is not None else 'n/a'} (credits)")
    print(f"Stacked-question turns: {len(stacked)} / {len(agent_turns)}")
    for t in stacked:
        print(f"  - {t.get('message')[:200]}")
    print(f"Delay median / worst: {med} / {worst}")
    print(f"Booked: {'yes' if booked else 'no'}   False 'all set': {'YES' if false_success else 'no'}")
    print("Tool calls:")
    for line in tool_log or ["  (none)"]:
        print(f"  {line}")
    dc = ((c.get("analysis") or {}).get("data_collection_results")) or {}
    if dc:
        print("Data collection: " + ", ".join(f"{k}={(v or {}).get('value')}" for k, v in dc.items()))
    print()
    print("RESULTS.md row (fill Date, Round, Waited?, Notes by reading the transcript):")
    print(f"| ? | ? | ? | {len(stacked)} / {len(agent_turns)} | ? | n/a (text) | n/a | "
          f"{'Yes' if false_success else 'No'} | {'Yes' if booked else 'No'} | {med} / {worst} | `{conv_id}` |")
    print()
    print("Transcript:")
    for t in transcript:
        if (t.get("message") or "").strip():
            ts = t.get("time_in_call_secs")
            print(f"  [{ts if ts is not None else '?'}s] {t.get('role')}: {t.get('message')}")


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("list", "score"):
        sys.exit(__doc__)
    key = load_key(arg("--key-env", "ELEVENLABS_API_KEY_blitz"))
    (cmd_list if sys.argv[1] == "list" else cmd_score)(sys.argv[2], key)


if __name__ == "__main__":
    main()
