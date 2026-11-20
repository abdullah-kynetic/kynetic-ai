import json
import threading
import time
import urllib.parse
import urllib.request
from typing import Callable
from ..models import CheckResult

_cache: dict[str, tuple[float, float]] = {}
_lock = threading.Lock()
_last_request = 0.0


def geocode(query: str, transport: Callable[[str, dict[str, str]], bytes], sleep: Callable[[float], None] = time.sleep) -> CheckResult:
    global _last_request
    key = query.strip().lower()
    if not key:
        return CheckResult("couldnt_check", reason="Nominatim query is empty")
    with _lock:
        if key in _cache:
            lat, lng = _cache[key]
        else:
            wait = 1.0 - (time.monotonic() - _last_request)
            if wait > 0: sleep(wait)
            url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": query, "format": "jsonv2", "limit": 1})
            try:
                raw = transport(url, {"User-Agent": "KyneticAudit/1.0 (+https://www.kyneticai.com)"})
                rows = json.loads(raw)
                if not rows: return CheckResult("couldnt_check", reason="Nominatim returned no result")
                lat, lng = float(rows[0]["lat"]), float(rows[0]["lon"])
                _cache[key] = (lat, lng)
                _last_request = time.monotonic()
            except (OSError, TimeoutError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
                return CheckResult("couldnt_check", reason=f"Nominatim failed: {type(exc).__name__}")
    return CheckResult("ok", {"latitude": lat, "longitude": lng})
