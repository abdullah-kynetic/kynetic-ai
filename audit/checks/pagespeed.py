import json
from typing import Callable
from urllib.parse import urlencode
from ..models import CheckResult


def fetch_pagespeed(website: str, api_key: str, transport: Callable[[str], bytes]) -> CheckResult:
    if not api_key:
        return CheckResult("couldnt_check")
    url = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + urlencode({
        "url": website, "key": api_key, "category": "performance", "strategy": "mobile"
    })
    try:
        payload = json.loads(transport(url))
        lighthouse = payload["lighthouseResult"]
        audits = lighthouse["audits"]
        return CheckResult("ok", {
            "performance_score": round(lighthouse["categories"]["performance"]["score"] * 100),
            "lcp_ms": audits.get("largest-contentful-paint", {}).get("numericValue"),
            "cls": audits.get("cumulative-layout-shift", {}).get("numericValue"),
            "inp_ms": audits.get("interaction-to-next-paint", {}).get("numericValue"),
        })
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return CheckResult("couldnt_check")

