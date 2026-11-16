"""Modal entrypoint and shared HTTP handler for the Kynetic audit service."""

import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from typing import Any

from .pdf.render import render_pdf
from .service import run

_runs: list[tuple[float, int]] = []
_month_runs: list[tuple[float, int]] = []


def _authorized(supplied: str | None) -> bool:
    expected = os.getenv("AUDIT_SERVICE_API_KEY", "")
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


def handle_request(payload: dict[str, Any], audit_key: str | None, pdf_dir: str | Path = "/tmp/kynetic-audit-pdfs") -> tuple[int, dict[str, Any]]:
    if not _authorized(audit_key):
        return 401, {"error": "unauthorized"}
    now = time.time()
    daily_cap = int(os.getenv("AUDIT_DAILY_CAP", "50"))
    monthly_cap = int(os.getenv("AUDIT_MONTHLY_CAP_CENTS", "2500"))
    _runs[:] = [(stamp, cost) for stamp, cost in _runs if now - stamp < 86400]
    _month_runs[:] = [(stamp, cost) for stamp, cost in _month_runs if now - stamp < 31 * 86400]
    if len(_runs) >= daily_cap or sum(cost for _, cost in _month_runs) >= monthly_cap:
        return 429, {"error": "audit capacity cap reached"}
    try:
        result = run(payload, audit_key, os.getenv("AUDIT_SERVICE_API_KEY"), html=payload.get("html", ""))
    except PermissionError:
        return 401, {"error": "unauthorized"}
    except (RuntimeError, ValueError) as exc:
        return 422, {"error": str(exc)}
    pdf_path = render_pdf(payload["business"]["name"], result["overall_score"], result["findings"],
                          Path(pdf_dir) / f"{result['run_id']}.pdf")
    result["pdf_url"] = f"/pdf/{pdf_path.name}"
    cost = int(result.get("cost_cents", 0))
    _runs.append((now, cost))
    _month_runs.append((now, cost))
    return 200, result


def health() -> dict[str, str]:
    return {"status": "ok", "service": "kynetic-audit"}


try:
    import modal

    image = (modal.Image.debian_slim(python_version="3.11")
             .apt_install("chromium", "nodejs", "npm")
             .pip_install("playwright"))
    app = modal.App("kynetic-audit")
    volume = modal.Volume.from_name("kynetic-audit-pdfs", create_if_missing=True)

    @app.function(image=image, volumes={"/mnt/pdfs": volume}, secrets=[modal.Secret.from_name("kynetic-audit-secrets")],
                   timeout=300, concurrency_limit=2)
    @modal.fastapi_endpoint(method="POST")
    def audit_endpoint(item: dict[str, Any], x_audit_key: str | None = None) -> dict[str, Any]:
        status, body = handle_request(item, x_audit_key, "/mnt/pdfs")
        if status != 200:
            raise Exception(json.dumps(body))
        return body

    @app.function(image=image)
    @modal.fastapi_endpoint(method="GET")
    def health_endpoint() -> dict[str, str]:
        return health()
except ImportError:  # Local installs can test the shared handler without Modal.
    app = None

