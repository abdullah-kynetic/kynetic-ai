#!/usr/bin/env python3
"""Provision NEW isolated step-2 resources. No calls, bookings, activation or existing-resource edits."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LIVE = 'agent_8201m5afn2rbeb7v29xfkhh1pjef'
STATE = ROOT / 'docs/codex/dev-resources.json'


def api(base, path, headers, method='GET', data=None, form=False):
    encoded = None
    if data is not None:
        encoded = urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode()
    req = urllib.request.Request(base + path, data=encoded, method=method, headers={
        **headers, 'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Provider messages can echo credentials/phone numbers. Print only safe status/code.
        try:
            raw = json.load(error)
            code = raw.get('code') if isinstance(raw, dict) else None
            code = code if isinstance(code, int) else None
        except Exception:
            code = None
        raise RuntimeError(f'{method} provider request failed: HTTP {error.code}, code {code}') from None


def fingerprint(agent):
    fields = {k: agent.get(k) for k in ['name', 'conversation_config', 'platform_settings', 'workflow', 'phone_numbers', 'branch_id', 'version_id']}
    return hashlib.sha256(json.dumps(fields, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not args.apply:
        print('Plan: create DEV agent, inactive DEV workflow, NEW DEV Twilio number and import it to Blitz; disable inbound/SMS on the new number. No calls or bookings. Existing resources unchanged.')
        return
    raise RuntimeError('DEV environment retired until after go-live (2026-11-09 PST). This apply path does not run. See docs/STATUS.md.')

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, urllib.error.URLError, KeyError) as error:
        # Avoid tracebacks/request objects that might carry authentication headers.
        print(str(error) if isinstance(error, RuntimeError) else 'Provisioning failed: ' + type(error).__name__)
        raise SystemExit(1)
