import json
import time
import urllib.error
from typing import Callable
from urllib.parse import urlencode, urlparse, urlunparse
from ..models import CheckResult

BASE_CATEGORIES = ("performance", "seo", "accessibility", "best-practices")


class MissingPerformanceScore(ValueError):
    """The API returned Lighthouse data without a usable performance score."""


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


def build_pagespeed_url(website: str, api_key: str) -> str:
    params: list[tuple[str, str]] = [("url", normalize_target(website)), ("key", api_key),
                                     ("strategy", "mobile")]
    params.extend(("category", category) for category in BASE_CATEGORIES)
    return "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + urlencode(params)


def _failure(exc: Exception, api_key: str) -> CheckResult:
    message = str(exc).replace(api_key, "[redacted]") if api_key else str(exc)
    return CheckResult("couldnt_check", reason=f"PageSpeed {type(exc).__name__}: {message or 'response could not be parsed'}")


def _parse_success(raw: bytes, allow_missing_performance: bool = False) -> dict[str, object]:
    payload = json.loads(raw)
    lighthouse = payload.get("lighthouseResult")
    if not isinstance(lighthouse, dict):
        raise ValueError("missing lighthouseResult")
    audits = lighthouse.get("audits")
    categories = lighthouse.get("categories")
    if not isinstance(audits, dict) or not isinstance(categories, dict):
        raise ValueError("missing lighthouse audits or categories")
    scores: dict[str, int | None] = {}
    missing: list[str] = []
    for name in BASE_CATEGORIES:
        category = categories.get(name)
        score = category.get("score") if isinstance(category, dict) else None
        if not isinstance(score, (int, float)) or isinstance(score, bool):
            if allow_missing_performance:
                scores[name] = None
                missing.append(name)
                continue
            if name == "performance":
                raise MissingPerformanceScore("missing performance score")
            raise ValueError(f"missing {name} score")
        scores[name] = round(score * 100)
    data: dict[str, object] = {
        "scores": scores,
        "performance_score": scores["performance"],
        "lcp_ms": audits.get("largest-contentful-paint", {}).get("numericValue")
        if isinstance(audits.get("largest-contentful-paint", {}), dict) else None,
        "cls": audits.get("cumulative-layout-shift", {}).get("numericValue")
        if isinstance(audits.get("cumulative-layout-shift", {}), dict) else None,
        "inp_ms": audits.get("interaction-to-next-paint", {}).get("numericValue")
        if isinstance(audits.get("interaction-to-next-paint", {}), dict) else None,
    }
    if missing:
        data["category_status"] = {
            name: {"status": "couldnt_check", "reason": f"missing {name} score"}
            for name in missing
        }
        if "performance" in missing:
            data["performance"] = {"status": "couldnt_check", "reason": "missing performance score"}
    return data


def fetch_pagespeed(website: str, api_key: str, transport: Callable[[str], object], sleep: Callable[[float], None] = time.sleep) -> CheckResult:
    if not api_key:
        return CheckResult("couldnt_check", reason="PageSpeed API key is not configured")
    url = build_pagespeed_url(website, api_key)
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
            try:
                return CheckResult("ok", _parse_success(raw))
            except MissingPerformanceScore:
                if attempt == 0:
                    sleep(2.0)
                    continue
                return CheckResult("ok", _parse_success(raw, allow_missing_performance=True))
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
            return _failure(exc, api_key)
    return CheckResult("couldnt_check", reason="PageSpeed retry budget exhausted")

