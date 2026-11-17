"""Modal entrypoint and shared HTTP handler for the Kynetic audit service."""

import asyncio
import hashlib
import hmac
import os
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from .pdf.render import render_pdf
from .service import run

_runs: list[tuple[float, int]] = []
_month_runs: list[tuple[float, int]] = []
_PDF_NAME = re.compile(r"^[0-9a-f-]{36}\.pdf$")
_PDF_TTL_SECONDS = 3600
_DAILY_CAP = int(os.getenv("AUDIT_DAILY_CAP_OVERRIDE", os.getenv("AUDIT_DAILY_CAP", "50")))


def _authorized(supplied: str | None) -> bool:
    expected = os.getenv("AUDIT_SERVICE_API_KEY", "")
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


def _sign_pdf(name: str, ttl: int = _PDF_TTL_SECONDS) -> str:
    exp = int(time.time()) + ttl
    secret = os.getenv("AUDIT_SERVICE_API_KEY", "").encode()
    sig = hmac.new(secret, f"{name}:{exp}".encode(), hashlib.sha256).hexdigest()
    return f"/pdf/{name}?exp={exp}&sig={sig}"


def _valid_pdf_signature(name: str, exp: str | None, sig: str | None) -> bool:
    if not exp or not sig or not _PDF_NAME.match(name):
        return False
    try:
        expires = int(exp)
    except ValueError:
        return False
    if expires < int(time.time()):
        return False
    secret = os.getenv("AUDIT_SERVICE_API_KEY", "").encode()
    expected = hmac.new(secret, f"{name}:{expires}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


def handle_request(payload: dict[str, Any], audit_key: str | None, pdf_dir: str | Path = "/tmp/kynetic-audit-pdfs", operator_key: str | None = None) -> tuple[int, dict[str, Any]]:
    if not _authorized(audit_key):
        return 401, {"error": "unauthorized"}
    now = time.time()
    daily_cap = _DAILY_CAP
    monthly_cap = int(os.getenv("AUDIT_MONTHLY_CAP_CENTS", "2500"))
    _runs[:] = [(stamp, cost) for stamp, cost in _runs if now - stamp < 86400]
    _month_runs[:] = [(stamp, cost) for stamp, cost in _month_runs if now - stamp < 31 * 86400]
    if len(_runs) >= daily_cap or sum(cost for _, cost in _month_runs) >= monthly_cap:
        return 429, {"error": "audit capacity cap reached"}
    try:
        expected_operator = os.getenv("AUDIT_OPERATOR_KEY", "")
        operator_authorized = bool(expected_operator and operator_key and hmac.compare_digest(expected_operator, operator_key))
        result = run(payload, audit_key, os.getenv("AUDIT_SERVICE_API_KEY"), html=payload.get("html", ""), operator_authorized=operator_authorized)
    except PermissionError:
        return 401, {"error": "unauthorized"}
    except (RuntimeError, ValueError) as exc:
        return 422, {"error": str(exc)}
    try:
        pdf_path = render_pdf(payload["business"]["name"], result["overall_score"], result["findings"],
                              Path(pdf_dir) / f"{result['run_id']}.pdf")
        result["pdf_url"] = f"/pdf/{pdf_path.name}"
    except Exception:
        result["pdf_url"] = None
    cost = int(result.get("cost_cents", 0))
    _runs.append((now, cost))
    _month_runs.append((now, cost))
    return 200, result


def health() -> dict[str, str]:
    return {"status": "ok", "service": "kynetic-audit"}


try:
    import modal  # type: ignore[import-not-found]

    image = (
        modal.Image.debian_slim(python_version="3.11")
        .apt_install("ca-certificates", "curl", "fonts-liberation", "fonts-dejavu-core")
        .pip_install("playwright", "fastapi")
        .run_commands(
            "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs",
            "node --version",
            "npm install -g unlighthouse@0.19.1",
            "python -m playwright install --with-deps chromium",
        )
        .add_local_python_source("audit")
    )
    app = modal.App("kynetic-audit")
    volume = modal.Volume.from_name("kynetic-audit-pdfs", create_if_missing=True)

    @app.function(
        image=image,
        volumes={"/mnt/pdfs": volume},
        secrets=[modal.Secret.from_name("kynetic-audit-secrets")],
        timeout=300,
        max_containers=2,
        memory=2048,
    )
    @modal.asgi_app()
    def web():
        from fastapi import FastAPI, Header, Request  # type: ignore[import-not-found]
        from fastapi.responses import FileResponse, JSONResponse  # type: ignore[import-not-found]

        api = FastAPI()

        @api.get("/health")
        def health_route() -> dict[str, str]:
            return health()

        @api.post("/audit")
        async def audit_route(request: Request, x_audit_key: str | None = Header(default=None, alias="X-Audit-Key")):
            item = await request.json()
            status, body = await asyncio.to_thread(handle_request, item, x_audit_key, "/mnt/pdfs", request.headers.get("X-Operator-Key"))
            if status == 200 and body.get("pdf_url"):
                name = Path(str(body["pdf_url"])).name
                body["pdf_url"] = _sign_pdf(name)
                volume.commit()
            return JSONResponse(body, status_code=status)

        @api.get("/pdf/{name}")
        def pdf_route(name: str, request: Request):
            query = parse_qs(urlparse(str(request.url)).query)
            exp_values = query.get("exp")
            sig_values = query.get("sig")
            exp = exp_values[0] if exp_values else None
            sig = sig_values[0] if sig_values else None
            if not _valid_pdf_signature(name, exp, sig):
                return JSONResponse({"error": "unauthorized"}, status_code=401)
            volume.reload()
            path = Path("/mnt/pdfs") / name
            if not path.is_file():
                return JSONResponse({"error": "not found"}, status_code=404)
            return FileResponse(path, media_type="application/pdf", filename=name)

        return api
except ImportError:  # Local installs can test the shared handler without Modal.
    app = None
