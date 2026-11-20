import json
import time
import urllib.error
from collections.abc import Callable
from urllib.parse import urlencode, urlparse, urlunparse
from ..models import CheckResult

BASE_CATEGORIES = ("performance", "seo", "accessibility", "best-practices")
METRICS = (("first-contentful-paint", "First content shows"), ("largest-contentful-paint", "Main content shows"),
           ("total-blocking-time", "Page frozen while loading"), ("cumulative-layout-shift", "Layout jumps"),
           ("speed-index", "Speed index"))


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
    if isinstance(body, bytes):
        return int(status), body
    if isinstance(body, bytearray):
        return int(status), bytes(body)
    raise TypeError("PageSpeed transport returned a non-bytes body")


def build_pagespeed_url(website: str, api_key: str, strategy: str = "mobile") -> str:
    params: list[tuple[str, str]] = [("url", normalize_target(website)), ("key", api_key),
                                     ("strategy", strategy)]
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
    data["metrics"] = {
        key: {"label": label, "value": audits.get(key, {}).get("displayValue"),
              "score": audits.get(key, {}).get("score")}
        for key, label in METRICS if isinstance(audits.get(key), dict)
    }
    opportunities = []
    for audit_id, audit in audits.items():
        if not isinstance(audit, dict):
            continue
        details = audit.get("details") or {}
        savings = details.get("overallSavingsMs") or (audit.get("metricSavings") or {}).get("LCP") or 0
        score = audit.get("score")
        if isinstance(score, (int, float)) and score < 0.9 and isinstance(savings, (int, float)) and savings >= 150:
            opportunities.append({"id": audit_id, "title": audit.get("title", audit_id),
                                  "savings_ms": round(savings)})
    opportunities.sort(key=lambda item: -item["savings_ms"])
    data["opportunities"] = opportunities[:6]
    if missing:
        data["category_status"] = {
            name: {"status": "couldnt_check", "reason": f"missing {name} score"}
            for name in missing
        }
        if "performance" in missing:
            data["performance"] = {"status": "couldnt_check", "reason": "missing performance score"}
    return data


def fetch_pagespeed(website: str, api_key: str, transport: Callable[[str], object], sleep: Callable[[float], None] = time.sleep,
                    strategy: str = "mobile") -> CheckResult:
    if not api_key:
        return CheckResult("couldnt_check", reason="PageSpeed API key is not configured")
    url = build_pagespeed_url(website, api_key, strategy)
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



def parse_lighthouse_report(raw: bytes | str) -> dict[str, object]:
    """Parse a Lighthouse CLI JSON report (same audits as the PageSpeed API, run on our own browser)."""
    payload = json.loads(raw)
    return _parse_success(json.dumps({"lighthouseResult": payload}).encode(), allow_missing_performance=True)


def run_local_lighthouse(website: str, strategy: str = "mobile", timeout: int = 120) -> CheckResult:
    """Fallback when the PageSpeed API is unavailable: run the pinned Lighthouse CLI against our own Chromium."""
    import os
    import shutil
    import subprocess
    import tempfile
    from .unlighthouse import discover_chrome

    binary = shutil.which("lighthouse")
    if not binary:
        return CheckResult("couldnt_check", reason="Lighthouse CLI is not installed")
    chrome = discover_chrome()
    env = os.environ.copy()
    if chrome:
        env["CHROME_PATH"] = chrome
    with tempfile.TemporaryDirectory(prefix="lh-") as work:
        out = os.path.join(work, "report.json")
        command = [binary, normalize_target(website), "--output=json", f"--output-path={out}", "--quiet",
                   "--only-categories=" + ",".join(BASE_CATEGORIES),
                   "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage"]
        if strategy == "desktop":
            command.append("--preset=desktop")
        try:
            completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout, env=env, check=False)
        except subprocess.TimeoutExpired:
            return CheckResult("couldnt_check", reason=f"Lighthouse {strategy} run timed out")
        if not os.path.isfile(out):
            tail = (completed.stderr or completed.stdout or "").strip()[-300:]
            return CheckResult("couldnt_check", reason=f"Lighthouse {strategy} run failed: {tail or 'no output'}")
        try:
            with open(out, "rb") as handle:
                return CheckResult("ok", parse_lighthouse_report(handle.read()))
        except (ValueError, KeyError, TypeError) as exc:
            return CheckResult("couldnt_check", reason=f"Lighthouse report could not be parsed: {exc}")


def speed_check(website: str, api_key: str, transport: Callable[[str], object] | None,
                local: Callable[[str, str], CheckResult] | None = run_local_lighthouse,
                strategies: tuple[str, ...] = ("mobile", "desktop")) -> CheckResult:
    """Mobile and desktop Lighthouse results: PageSpeed API first, our own Lighthouse run as the fallback."""
    from ..net import now_iso
    started = time.monotonic()
    results: dict[str, object] = {}
    tools: set[str] = set()
    reasons: list[str] = []
    for strategy in strategies:
        result = (fetch_pagespeed(website, api_key, transport, strategy=strategy)
                  if api_key and transport else CheckResult("couldnt_check", reason="PageSpeed API key is not configured"))
        if result.status == "ok":
            tools.add("Google PageSpeed Insights (Lighthouse)")
        elif local is not None:
            reasons.append(result.reason or "PageSpeed failed")
            result = local(website, strategy)
            if result.status == "ok":
                tools.add("Lighthouse (run by Kynetic)")
        if result.status == "ok":
            results[strategy] = result.data
        else:
            reasons.append(result.reason or f"{strategy} speed test failed")
    tool = " + ".join(sorted(tools)) or "Google PageSpeed Insights (Lighthouse)"
    ms = round((time.monotonic() - started) * 1000)
    if not results:
        return CheckResult("couldnt_check", reason="; ".join(reasons) or "speed test failed", ms=ms, tool=tool,
                           sources=(normalize_target(website),), observed_at=now_iso())
    mobile = results.get("mobile") or next(iter(results.values()))
    return CheckResult("ok", {**results, "performance_score": mobile.get("performance_score"),  # type: ignore[union-attr]
                              "scores": mobile.get("scores"), "notes": reasons}, ms=ms, tool=tool,  # type: ignore[union-attr]
                       sources=(normalize_target(website),), observed_at=now_iso())
