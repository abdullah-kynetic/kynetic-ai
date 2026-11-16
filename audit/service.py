import hashlib
import hmac
import os
import time
import uuid
from dataclasses import asdict
from typing import Any

from .checks import inspect_html, inspect_signals
from .models import AuditRequest, Business, CheckResult
from .scoring import findings, score

REJECTED_STATES = {"FL", "OK"}
_cache: dict[str, dict[str, Any]] = {}
_cost_log: list[dict[str, Any]] = []


def parse_request(payload: dict[str, Any]) -> AuditRequest:
    business = payload.get("business") or {}
    mode = payload.get("mode")
    if mode not in {"free", "full", "operator"}: raise ValueError("invalid mode")
    required = ("name", "website", "city", "state", "industry")
    if any(not isinstance(business.get(x), str) or not business[x].strip() for x in required):
        raise ValueError("business fields are required")
    if business["state"].upper() in REJECTED_STATES or "hipaa" in business["industry"].lower():
        raise ValueError("unsupported business")
    answers = payload.get("answers") or {}
    if mode == "operator" and answers: raise ValueError("operator runs cannot include answers")
    return AuditRequest(mode, Business(**{x: business[x].strip() for x in required}), answers,
                        str(payload.get("idempotency_key", "")))


def _auth(expected: str | None, supplied: str | None) -> bool:
    if not expected or not supplied: return False
    return hmac.compare_digest(expected.encode(), supplied.encode())


def run(payload: dict[str, Any], supplied_key: str | None = None, expected_key: str | None = None,
        html: str = "") -> dict[str, Any]:
    if not _auth(expected_key or os.getenv("AUDIT_SERVICE_API_KEY"), supplied_key):
        raise PermissionError("unauthorized")
    request = parse_request(payload)
    if request.idempotency_key and request.idempotency_key in _cache:
        return _cache[request.idempotency_key]
    daily_cap = int(os.getenv("AUDIT_DAILY_CAP", "50"))
    if len(_cost_log) >= daily_cap: raise RuntimeError("daily cap reached")
    started = time.monotonic()
    checks: dict[str, dict[str, Any]] = {}
    if html:
        checks["seo"] = asdict(inspect_html(html))
        checks["signals"] = asdict(inspect_signals(html))
    else:
        checks["seo"] = asdict(CheckResult("couldnt_check"))
        checks["signals"] = asdict(CheckResult("couldnt_check"))
    scored = score(request.answers if request.mode != "operator" else {}, checks)
    result = {"run_id": str(uuid.uuid4()), "mode": request.mode, **scored,
              "findings": findings(scored), "teaser": "CRM + KPI dashboard are phase 1 priorities.",
              "locked_sections": [] if request.mode == "full" else ["full_business_audit"],
              "checks": checks, "pdf_url": None, "cost_cents": 0,
              "duration_ms": round((time.monotonic() - started) * 1000)}
    _cost_log.append({"run_id": result["run_id"], "cost_cents": 0})
    if request.idempotency_key: _cache[request.idempotency_key] = result
    return result

