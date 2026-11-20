"""Outbound HTTP for checks: one user agent, size limits, and a guard against private-network targets.

The business website comes from a public form, so the crawler refuses hosts that resolve to private,
loopback, link-local or reserved addresses before any request is made.
"""

from __future__ import annotations

import ipaddress
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone

USER_AGENT = "Mozilla/5.0 (compatible; KyneticAudit/2.0; +https://www.kyneticai.com)"
MAX_BYTES = 2_000_000


@dataclass(frozen=True)
class Response:
    status: int
    url: str
    body: bytes = b""
    headers: dict[str, str] = field(default_factory=dict)

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


class BlockedTarget(ValueError):
    """The URL points at a non-public address or an unsupported scheme."""


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_url(website: str) -> str:
    value = website.strip()
    if "://" not in value:
        value = "https://" + value
    parsed = urllib.parse.urlparse(value)
    return urllib.parse.urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", "", parsed.query, ""))


def assert_public(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise BlockedTarget("only public http(s) URLs are audited")
    host = parsed.hostname
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise BlockedTarget(f"could not resolve {host}") from exc
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global:
            raise BlockedTarget(f"{host} resolves to a non-public address")


class _GuardedRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401 - urllib hook
        assert_public(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_GuardedRedirects)


def fetch(url: str, timeout: float = 20, headers: dict[str, str] | None = None, guard: bool = True) -> Response:
    """GET a URL. HTTP errors come back as a Response with their status; network errors raise OSError."""
    if guard:
        assert_public(url)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9",
                                                   **(headers or {})})
    try:
        with _opener.open(request, timeout=timeout) as response:
            return Response(response.status, response.geturl(), response.read(MAX_BYTES),
                            {k.lower(): v for k, v in response.headers.items()})
    except urllib.error.HTTPError as exc:
        body = b""
        try:
            body = exc.read(MAX_BYTES)
        except Exception:  # pragma: no cover - defensive
            pass
        return Response(exc.code, url, body, {k.lower(): v for k, v in (exc.headers or {}).items()})
