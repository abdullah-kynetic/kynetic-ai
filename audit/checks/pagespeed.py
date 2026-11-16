import json
import time
import urllib.error
from typing import Callable
from urllib.parse import urlencode, urlparse, urlunparse
from ..models import CheckResult

BASE_CATEGORIES = ("performance", "seo", "accessibility", "best-practices")


def normalize_target(website: str) -> str:
    value = website.strip()
    if "://" not in value:
        value = f"https://{value}"
    parsed = urlparse(value)
    path = parsed.path or "/"
    if not path.endswith("/"):
        path += "/"
    return urlunparse((parsed.scheme.lower(), parsed.netloc, path, "", parsed.query, ""))


def _response(value: object) -> tuple[int, bytes]:
    if isinstance(value, tuple) and len(value) == 2:
        return int(value[0]), bytes(value[1])
    status = getattr(value, "status", 200)
    body = value.read() if hasattr(value, "read") else value
    return int(status), bytes(body)


def fetch_pagespeed(website: str, api_key: str, transport: Callable[[str], object], sleep: Callable[[float], None] = time.sleep) -> CheckResult:
    if not api_key:
        return CheckResult("couldnt_check", reason="PageSpeed API key is not configured")
    params: list[tuple[str, str]] = [("url", normalize_target(website)), ("key", api_key),
                                     ("strategy", "mobile")]
    params.extend(("category", category) for category in BASE_CATEGORIES)
    url = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + urlencode(params)
    for attempt in range(2):
        try:
            status, raw = _response(transport(url))
            if status != 200:
                if status == 429 or status >= 500:
                    if attempt == 0:
                        sleep(0.1)
                        continue
                try:
                    detail = json.loads(raw).get("error", {}).get("message", "HTTP error")
                except (TypeError, ValueError, json.JSONDecodeError):
                    detail = "HTTP error"
                return CheckResult("couldnt_check", reason=f"PageSpeed HTTP {status}: {detail}")
            payload = json.loads(raw)
            lighthouse = payload["lighthouseResult"]
            audits = lighthouse["audits"]
            categories = lighthouse.get("categories", {})
            return CheckResult("ok", {
                "scores": {name: round((categories.get(name, {}).get("score") or 0) * 100)
                           for name in BASE_CATEGORIES},
                "performance_score": round(lighthouse["categories"]["performance"]["score"] * 100),
                "lcp_ms": audits.get("largest-contentful-paint", {}).get("numericValue"),
                "cls": audits.get("cumulative-layout-shift", {}).get("numericValue"),
                "inp_ms": audits.get("interaction-to-next-paint", {}).get("numericValue"),
            })
        except urllib.error.HTTPError as exc:
            if exc.code in (429,) or exc.code >= 500:
                if attempt == 0:
                    sleep(0.1)
                    continue
            try:
                detail = json.loads(exc.read()).get("error", {}).get("message", "HTTP error")
            except (TypeError, ValueError, json.JSONDecodeError):
                detail = "HTTP error"
            return CheckResult("couldnt_check", reason=f"PageSpeed HTTP {exc.code}: {detail}")
        except (KeyError, TypeError, ValueError, json.JSONDecodeError, OSError, TimeoutError) as exc:
            return CheckResult("couldnt_check", reason=f"PageSpeed response could not be parsed: {type(exc).__name__}")
    return CheckResult("couldnt_check", reason="PageSpeed retry budget exhausted")

