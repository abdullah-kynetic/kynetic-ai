"""Probe audit providers one at a time without printing secrets or result payloads."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from audit.checks.ai_mentions import check_mentions_with_fallback
from audit.checks.maps import fetch_public_maps
from audit.checks.pagespeed import fetch_pagespeed
from audit.checks.unlighthouse import run_unlighthouse
from audit.geogrid import full_audit_grid
from audit.models import CheckResult
from audit.service import _http_get, _openrouter_ask, _openrouter_models, _pagespeed_transport


def _line(name: str, result: CheckResult) -> None:
    print(json.dumps({"check": name, "status": result.status,
                      "reason": result.reason or ""}, sort_keys=True))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="business website URL")
    parser.add_argument("--name", default="Probe business")
    parser.add_argument("--city", default="Austin")
    parser.add_argument("--state", default="TX")
    parser.add_argument("--industry", default="contractor")
    parser.add_argument("--mode", choices=("free", "full"), default="free")
    parser.add_argument("--check", choices=("all", "pagespeed", "ai_mentions", "maps", "geogrid", "unlighthouse"), default="all")
    args = parser.parse_args()
    business = {"name": args.name, "website": args.url, "city": args.city,
                "state": args.state, "industry": args.industry}
    selected = {args.check} if args.check != "all" else {"pagespeed", "ai_mentions", "maps", "geogrid", "unlighthouse"}

    if "pagespeed" in selected:
        _line("pagespeed", fetch_pagespeed(args.url, os.getenv("GOOGLE_PAGESPEED_API_KEY", ""), _pagespeed_transport))
    if "ai_mentions" in selected:
        models = _openrouter_models() or [os.getenv("AUDIT_OPENROUTER_MODEL", "google/gemma-4-26b-a4b-it:free")]
        _line("ai_mentions", check_mentions_with_fallback(business, models, _openrouter_ask))
    if "maps" in selected:
        _line("maps", fetch_public_maps(f"{args.name} {args.city} {args.state}", args.name))
    if "geogrid" in selected:
        _line("geogrid", full_audit_grid(business, lambda url, headers: _http_get(url, headers=headers)))
    if "unlighthouse" in selected:
        _line("unlighthouse", run_unlighthouse(args.mode, args.url))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
