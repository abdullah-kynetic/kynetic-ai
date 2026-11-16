import json
import os
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, fields
from typing import Any

from .checks import check_mentions, fetch_pagespeed, inspect_html, inspect_signals, parse_maps_page
from .checks.full import run_full_only, run_operator_only
from .config import require_free_model
from .models import AuditRequest, Business, CheckResult
from .scoring import findings, score

REJECTED_STATES = {"FL", "OK"}
DEFAULT_FREE_MODEL = "google/gemma-4-26b-a4b-it:free"
_USER_AGENT = "KyneticAudit/1.0 (+https://www.kyneticai.com)"
_cache: dict[str, dict[str, Any]] = {}
_cost_log: list[dict[str, Any]] = []


def parse_request(payload: dict[str, Any]) -> AuditRequest:
    business = payload.get("business") or {}
    mode = payload.get("mode")
    if mode not in {"free", "full", "operator"}:
        raise ValueError("invalid mode")
    required = ("name", "website", "city", "state", "industry")
    if any(not isinstance(business.get(x), str) or not business[x].strip() for x in required):
        raise ValueError("business fields are required")
    if business["state"].upper() in REJECTED_STATES or "hipaa" in business["industry"].lower():
        raise ValueError("unsupported business")
    answers = payload.get("answers") or {}
    if mode == "operator" and answers:
        raise ValueError("operator runs cannot include answers")
    return AuditRequest(mode, Business(**{x: business[x].strip() for x in required}), answers,
                        str(payload.get("idempotency_key", "")))


def _auth(expected: str | None, supplied: str | None) -> bool:
    if not expected or not supplied:
        return False
    import hmac
    return hmac.compare_digest(expected.encode(), supplied.encode())


def _http_get(url: str, timeout: int = 25, headers: dict[str, str] | None = None) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read(1_500_000)


def _fetch_html(website: str) -> str:
    url = website if "://" in website else f"https://{website}"
    try:
        return _http_get(url).decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return ""


def _pagespeed_transport(url: str) -> bytes:
    return _http_get(url, timeout=90)


def _openrouter_ask(model: str, prompt: str) -> str:
    model = require_free_model(model)
    key = os.getenv("OPENROUTER_API_KEY", "")
    if not key:
        raise TimeoutError("openrouter key missing")
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 220,
        "temperature": 0,
    }).encode()
    request = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": _USER_AGENT,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.loads(response.read())
        return body["choices"][0]["message"]["content"]
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise TimeoutError("openrouter request failed") from exc


def _maps_html(business: Business) -> str:
    query = urllib.parse.quote_plus(f"{business.name} {business.city} {business.state}")
    url = f"https://www.google.com/maps/search/{query}"
    try:
        return _http_get(url, timeout=20).decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return ""


def collect_checks(request: AuditRequest, html: str = "") -> dict[str, dict[str, Any]]:
    """Run site/provider checks. Provided HTML keeps tests offline; live fetches run only when it is empty."""
    checks: dict[str, dict[str, Any]] = {}
    page_html = html or _fetch_html(request.business.website)
    if page_html:
        checks["seo"] = asdict(inspect_html(page_html))
        checks["signals"] = asdict(inspect_signals(page_html))
    else:
        checks["seo"] = asdict(CheckResult("couldnt_check"))
        checks["signals"] = asdict(CheckResult("couldnt_check"))

    if not html:
        pagespeed_key = os.getenv("GOOGLE_PAGESPEED_API_KEY", "")
        if pagespeed_key:
            checks["pagespeed"] = asdict(fetch_pagespeed(request.business.website, pagespeed_key, _pagespeed_transport))
        else:
            checks["pagespeed"] = asdict(CheckResult("couldnt_check"))
        maps_html = _maps_html(request.business)
        checks["maps"] = asdict(parse_maps_page(maps_html) if maps_html else CheckResult("couldnt_check"))
        model = os.getenv("AUDIT_OPENROUTER_MODEL", DEFAULT_FREE_MODEL)
        business = {field.name: getattr(request.business, field.name) for field in fields(Business)}
        checks["ai_mentions"] = asdict(check_mentions(business, model, _openrouter_ask))
        def _geogrid() -> dict:
            raise RuntimeError("no business coordinates available")
        checks["geogrid"] = asdict(run_full_only(request.mode, "geogrid", _geogrid))
        checks["unlighthouse"] = asdict(run_full_only(request.mode, "unlighthouse", lambda: (_ for _ in ()).throw(
            RuntimeError("unlighthouse not configured")
        )))
        checks["phantomreach"] = asdict(run_operator_only(request.mode, lambda: (_ for _ in ()).throw(
            RuntimeError("phantomreach is not vendored")
        )))
    return checks


def run(payload: dict[str, Any], supplied_key: str | None = None, expected_key: str | None = None,
        html: str = "") -> dict[str, Any]:
    if not _auth(expected_key or os.getenv("AUDIT_SERVICE_API_KEY"), supplied_key):
        raise PermissionError("unauthorized")
    request = parse_request(payload)
    if request.idempotency_key and request.idempotency_key in _cache:
        return _cache[request.idempotency_key]
    daily_cap = int(os.getenv("AUDIT_DAILY_CAP", "50"))
    if len(_cost_log) >= daily_cap:
        raise RuntimeError("daily cap reached")
    started = time.monotonic()
    checks = collect_checks(request, html)
    scored = score(request.answers if request.mode != "operator" else {}, checks)
    cost = sum(int(item.get("cost_cents") or 0) for item in checks.values())
    result = {"run_id": str(uuid.uuid4()), "mode": request.mode, **scored,
              "findings": findings(scored), "teaser": "CRM + KPI dashboard are phase 1 priorities.",
              "locked_sections": [] if request.mode == "full" else ["full_business_audit"],
              "checks": checks, "pdf_url": None, "cost_cents": cost,
              "duration_ms": round((time.monotonic() - started) * 1000)}
    _cost_log.append({"run_id": result["run_id"], "cost_cents": cost})
    if request.idempotency_key:
        _cache[request.idempotency_key] = result
    return result
