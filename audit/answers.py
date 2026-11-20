"""The questions a prospect answers, normalized from whatever form sent them.

Accepted keys (all optional, free text):
  lead_source, after_hours, response_time, monthly_leads, follow_up, time_drain, team_size, revenue,
  avg_job_value, close_rate, crm, fix_first
The website application's keys (niche, revenue, teamTime, fixFirst, invest) are accepted too, as are the
legacy q1-q6 keys. Unknown keys are kept and shown in the report under "What you told us".
"""

from __future__ import annotations

import re

from .models import Item

LABELS = {
    "lead_source": "How most new customers find you",
    "after_hours": "What happens when a call or message is missed",
    "response_time": "How fast a new lead hears back",
    "monthly_leads": "New leads or inquiries a month",
    "follow_up": "How leads are followed up",
    "crm": "Where customer details are kept",
    "time_drain": "Biggest time drain",
    "team_size": "Team size",
    "revenue": "Annual revenue",
    "avg_job_value": "Average job value",
    "close_rate": "Share of estimates that become jobs",
    "fix_first": "What you'd fix first",
    "team_time": "What takes up the team's time",
    "niche": "Business type",
    "invest": "What you could invest",
}
ALIASES = {"teamTime": "team_time", "fixFirst": "fix_first", "q1": "monthly_leads", "q2": "response_time",
           "q3": "close_rate", "q4": "time_drain", "q5": "crm", "q6": "follow_up"}


def normalize(raw: dict | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in (raw or {}).items():
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        name = ALIASES.get(str(key), str(key))
        out[name] = str(value).strip()[:400]
    return out


def number(value: str | None) -> tuple[float, float] | None:
    """Read "20-50", "150+", "$12,000", "about 30" into a (low, high) range."""
    if not value:
        return None
    text = value.lower().replace(",", "")
    nums = [float(n) * (1000 if k else 1) for n, k in re.findall(r"(\d+(?:\.\d+)?)\s*(k)?\b", text)]
    if not nums:
        return None
    if "under" in text or "less than" in text:
        return (nums[0] * 0.5, nums[0])
    if "+" in text or "over" in text or "more than" in text:
        return (nums[0], nums[0] * 1.5)
    return (min(nums), max(nums)) if len(nums) > 1 else (nums[0], nums[0])


def percent(value: str | None) -> tuple[float, float] | None:
    rng = number(value)
    if not rng:
        return None
    low, high = rng
    if high > 1:
        low, high = low / 100, high / 100
    return (max(0.0, min(low, 1.0)), max(0.0, min(high, 1.0)))


def _bad(value: str, *words: str) -> bool:
    return any(w in value.lower() for w in words)


def operations_items(answers: dict[str, str]) -> list[Item]:
    a = answers
    items: list[Item] = []
    if "after_hours" in a:
        bad = _bad(a["after_hours"], "nothing", "move on", "voicemail", "next morning", "next day", "later")
        good = _bad(a["after_hours"], "24/7", "answers", "ai", "service")
        items.append(Item("after_hours", LABELS["after_hours"], "pass" if good and not bad else "fail" if bad else "warn",
                          a["after_hours"], weight=2))
    if "response_time" in a:
        slow = _bad(a["response_time"], "day", "hour", "next", "later", "when")
        fast = _bad(a["response_time"], "minute", "instant", "immediately", "same-day", "same day")
        items.append(Item("response_time", LABELS["response_time"], "pass" if fast and "hour" not in a["response_time"]
                          else "fail" if slow else "warn", a["response_time"], weight=2))
    if "follow_up" in a:
        manual = _bad(a["follow_up"], "manual", "don't", "dont", "not really", "memory", "notebook", "rarely", "no ")
        items.append(Item("follow_up", LABELS["follow_up"], "fail" if manual else "pass" if _bad(a["follow_up"], "crm", "automat")
                          else "warn", a["follow_up"], weight=1.5))
    if "crm" in a:
        scattered = _bad(a["crm"], "spreadsheet", "paper", "notebook", "memory", "inbox", "phone", "not sure")
        items.append(Item("crm", LABELS["crm"], "fail" if scattered else "pass", a["crm"]))
    if "time_drain" in a:
        items.append(Item("time_drain", LABELS["time_drain"], "warn", a["time_drain"]))
    return items


def told_us(answers: dict[str, str]) -> list[dict[str, str]]:
    return [{"key": k, "label": LABELS.get(k, k.replace("_", " ").capitalize()), "value": v} for k, v in answers.items()]
