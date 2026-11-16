import math
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
    query = " ".join(filter(None, (business.get("name"), business.get("address"), business.get("city"), business.get("state"))))
    result = geocode(query, geocode_transport)
    if result.status != "ok": return result
    return CheckResult("ok", {"points": grid_points(result.data["latitude"], result.data["longitude"], count=count),
                               "label": "estimate"})

