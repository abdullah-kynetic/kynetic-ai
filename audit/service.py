import json
import os
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, fields
from typing import Any

from .checks import check_mentions_with_fallback, fetch_pagespeed, inspect_html, inspect_signals, parse_maps_page, run_unlighthouse
from .checks.ai_mentions import OpenRouterError
from .checks.maps import fetch_public_maps
from .checks.geocode import geocode
from .checks.full import run_full_only, run_operator_only
from .config import free_models_from_catalog
from .geogrid import full_audit_grid
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
    try:
        return 200, _http_get(url, timeout=90)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def _openrouter_ask(model: str, prompt: str) -> str:
    from .config import require_free_model
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
        with urllib.request.urlopen(request, timeout=10) as response:
            body = json.loads(response.read())
        return body["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as exc:
        raise OpenRouterError(exc.code, "OpenRouter request failed") from exc
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise OpenRouterError(0, "OpenRouter request failed") from exc


def _openrouter_models() -> list[str]:
    key = os.getenv("OPENROUTER_API_KEY", "")
    if not key: return []
    try:
        raw = _http_get("https://openrouter.ai/api/v1/models", timeout=10, headers={"Authorization": f"Bearer {key}"})
        rows = json.loads(raw).get("data", [])
        return free_models_from_catalog(rows)
    except (OSError, TimeoutError, ValueError, TypeError, json.JSONDecodeError):
        return []


def _maps_html(business: Business) -> str:
    query = urllib.parse.quote_plus(f"{business.name} {business.city} {business.state}")
    url = f"https://www.google.com/maps/search/{query}"
    try:
        return _http_get(url, timeout=20).decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return ""



def _safe_check(fn) -> dict[str, Any]:
    try:
        result = fn()
        return result if isinstance(result, dict) else asdict(result)
    except Exception:
        return asdict(CheckResult("couldnt_check"))


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
        checks["pagespeed"] = _safe_check(
            lambda: fetch_pagespeed(request.business.website, pagespeed_key, _pagespeed_transport)
            if pagespeed_key else CheckResult("couldnt_check")
        )
        checks["maps"] = _safe_check(lambda: fetch_public_maps(f"{request.business.name} {request.business.city} {request.business.state}"))
        models = _openrouter_models() or [os.getenv("AUDIT_OPENROUTER_MODEL", DEFAULT_FREE_MODEL)]
        business = {field.name: getattr(request.business, field.name) for field in fields(Business)}
        checks["ai_mentions"] = _safe_check(lambda: check_mentions_with_fallback(business, models, _openrouter_ask))
        checks["geogrid"] = _safe_check(lambda: run_full_only(request.mode, "geogrid", lambda: full_audit_grid(business, lambda url, headers: _http_get(url, headers=headers))))
        checks["unlighthouse"] = _safe_check(lambda: run_unlighthouse(request.mode, request.business.website))
        checks["phantomreach"] = _safe_check(lambda: run_operator_only(request.mode, lambda: {"status": "skipped", "reason": "operator key required"}))
    return checks


def run(payload: dict[str, Any], supplied_key: str | None = None, expected_key: str | None = None,
        html: str = "", operator_authorized: bool = False) -> dict[str, Any]:
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
    if request.mode != "operator" or not operator_authorized or not payload.get("operator_phantomreach"):
        checks["phantomreach"] = asdict(CheckResult("skipped", reason="public path cannot enable PhantomReach"))
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
