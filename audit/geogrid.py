import math
from urllib.parse import urlparse
from .models import CheckResult
from .checks.geocode import geocode


def grid_points(latitude: float, longitude: float, radius_m: int = 300, count: int = 9) -> list[tuple[float, float]]:
    """Small deterministic estimate grid; never presents itself as live ranking data."""
    count = max(5, min(9, count))
    points = [(latitude, longitude)]
    for index in range(1, count):
        angle = 2 * math.pi * (index - 1) / (count - 1)
        dlat = (radius_m / 111_320) * math.sin(angle)
        dlon = (radius_m / (111_320 * math.cos(math.radians(latitude)))) * math.cos(angle)
        points.append((round(latitude + dlat, 7), round(longitude + dlon, 7)))
    return points


def full_audit_grid(business: dict[str, str], geocode_transport, count: int = 9) -> CheckResult:
    name = business.get("name", "").strip()
    city = business.get("city", "").strip()
    state = business.get("state", "").strip()
    domain = urlparse(business.get("website", "")).netloc.removeprefix("www.")
    queries = [
        (" ".join(filter(None, (name, business.get("address"), city, state))), False),
        (" ".join(filter(None, (name, city, state))), False),
        (" ".join(filter(None, (domain, city, state))), False),
        (" ".join(filter(None, (city, state))), True),
    ]
    failures: list[str] = []
    for query, city_centered in queries:
        if not query: continue
        result = geocode(query, geocode_transport)
        if result.status == "ok":
            label = "estimate; centered on city" if city_centered else "estimate"
            return CheckResult("ok", {"points": grid_points(result.data["latitude"], result.data["longitude"], count=count),
                                       "label": label})
        failures.append(result.reason or "Nominatim lookup failed")
    return CheckResult("couldnt_check", reason="Nominatim could not center geogrid: " + "; ".join(failures))

