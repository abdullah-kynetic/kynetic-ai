"""Deterministic scores from evidence. No model output is used to create or change a score.

Each category is scored 0-100 only when its check ran. A category that could not be checked is left out
of the overall score (and the report says so) instead of counting as zero.
"""

from __future__ import annotations

from typing import Any

from .answers import operations_items
from .checks.util import score_items

CATEGORIES = {
    "seo": {"label": "Website & search", "weight": 1.0},
    "listing": {"label": "Google listing & local ranking", "weight": 1.25},
    "speed": {"label": "Site speed (phone)", "weight": 0.75},
    "capture": {"label": "Lead capture", "weight": 1.25},
    "trust": {"label": "Trust & reputation", "weight": 1.0},
    "ai": {"label": "AI assistant visibility", "weight": 0.5},
    "operations": {"label": "Follow-up & operations", "weight": 1.25},
}


def grade(score: int | None) -> str:
    if score is None:
        return "-"
    return "A" if score >= 85 else "B" if score >= 70 else "C" if score >= 55 else "D" if score >= 40 else "F"


def listing_score(data: dict[str, Any]) -> int | None:
    place = data.get("place") or {}
    parts: list[tuple[float, float]] = []
    parts.append((1.0 if place else 0.0, 25))
    rating, market = place.get("rating"), data.get("market_avg_rating")
    if rating is not None:
        gap = (market - rating) if market else (4.6 - rating)
        parts.append((1.0 if gap <= 0.05 else 0.6 if gap <= 0.3 else 0.25, 15))
    reviews = place.get("reviews")
    rivals = sorted(c["reviews"] for c in data.get("competitors", [])[:3] if c.get("reviews") is not None)
    if reviews is not None and rivals:
        median = rivals[len(rivals) // 2]
        parts.append((1.0 if reviews >= median else 0.6 if reviews >= median * 0.5 else 0.2, 20))
    grid = data.get("grid_summary")
    if grid and grid.get("points"):
        parts.append((grid["top3"] / grid["points"], 40))
    else:
        rank = data.get("local_rank")
        parts.append((1.0 if rank and rank <= 3 else 0.5 if rank and rank <= 10 else 0.0, 40))
    total = sum(w for _, w in parts)
    return round(100 * sum(v * w for v, w in parts) / total) if total else None


def speed_score(data: dict[str, Any]) -> int | None:
    mobile = (data.get("mobile") or {}).get("performance_score")
    desktop = (data.get("desktop") or {}).get("performance_score")
    if mobile is None and desktop is None:
        return None
    if mobile is None:
        return desktop
    if desktop is None:
        return mobile
    return round(mobile * 0.75 + desktop * 0.25)


def ai_score(data: dict[str, Any]) -> int | None:
    asked = data.get("asked") or 0
    return round(100 * (data.get("mentioned_in") or 0) / asked) if asked else None


def score(answers: dict[str, str], checks: dict[str, dict[str, Any]]) -> dict[str, Any]:
    def ok(name: str) -> dict[str, Any] | None:
        check = checks.get(name) or {}
        return check.get("data") if check.get("status") == "ok" else None

    sections: dict[str, int | None] = {
        "seo": (ok("seo") or {}).get("score"),
        "listing": listing_score(ok("listing")) if ok("listing") else None,
        "speed": speed_score(ok("speed")) if ok("speed") else None,
        "capture": (ok("capture") or {}).get("score"),
        "trust": (ok("trust") or {}).get("score"),
        "ai": ai_score(ok("ai_mentions")) if ok("ai_mentions") else None,
        "operations": score_items(operations_items(answers)) if answers else None,
    }
    weighted = [(value, CATEGORIES[key]["weight"]) for key, value in sections.items() if value is not None]
    overall = round(sum(v * w for v, w in weighted) / sum(w for _, w in weighted)) if weighted else None
    return {
        "overall_score": overall,
        "grade": grade(overall),
        "section_scores": sections,
        "sections": [{"key": key, "label": CATEGORIES[key]["label"], "score": value, "grade": grade(value),
                      "checked": value is not None} for key, value in sections.items()],
        "checked_categories": len(weighted),
    }
