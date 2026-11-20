from __future__ import annotations

from dataclasses import asdict

from ..models import Item

POINTS = {"pass": 1.0, "warn": 0.5, "fail": 0.0}


def score_items(items: list[Item]) -> int | None:
    """Weighted share of passed lines, 0-100. ``info`` and ``unknown`` lines do not count."""
    scored = [(POINTS[i.status], i.weight) for i in items if i.status in POINTS]
    total = sum(w for _, w in scored)
    if not total:
        return None
    return round(100 * sum(p * w for p, w in scored) / total)


def items_data(items: list[Item]) -> list[dict]:
    return [asdict(i) for i in items]


def yes(flag: bool, key: str, label: str, value_yes: str = "Yes", value_no: str = "Not found",
        note: str = "", weight: float = 1.0, miss: str = "fail") -> Item:
    return Item(key, label, "pass" if flag else miss, value_yes if flag else value_no, note, weight)
