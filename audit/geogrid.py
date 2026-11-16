import math


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

