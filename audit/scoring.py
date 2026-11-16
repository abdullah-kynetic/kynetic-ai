"""Deterministic problem scoring; no model output is used to create evidence."""

from typing import Any

PROBLEMS = (
    "Not getting found", "Losing leads", "Not converting",
    "No-shows and scheduling mess", "Owner buried in admin", "Slow cash",
    "No repeat or referral business", "Bad or no data", "Team bottlenecks",
)

QUESTION_TAGS: dict[str, tuple[str, ...]] = {
    "q1": ("Losing leads", "Not converting"),
    "q2": ("Losing leads",),
    "q3": ("Not converting", "Bad or no data"),
    "q4": ("Owner buried in admin",),
    "q5": ("Bad or no data",),
    "q6": ("No repeat or referral business",),
}


def _severity(answer: str) -> float:
    value = answer.lower()
    if any(x in value for x in ("150+", "often", "rarely", "not sure", "notebook", "memory")):
        return 1.0
    if any(x in value for x in ("50-150", "next day", "20-40%", "15-", "sometimes")):
        return 0.7
    return 0.35


def score(answers: dict[str, str], checks: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    evidence: dict[str, list[str]] = {p: [] for p in PROBLEMS}
    severity: dict[str, float] = {p: 0.0 for p in PROBLEMS}
    for question, answer in answers.items():
        for problem in QUESTION_TAGS.get(question, ()):
            evidence[problem].append(f"{question}: {answer}")
            severity[problem] = max(severity[problem], _severity(answer))
    if checks:
        seo = checks.get("seo", {})
        if seo.get("status") == "ok" and not seo.get("data", {}).get("indexable", True):
            evidence["Not getting found"].append("site: not indexable")
            severity["Not getting found"] = max(severity["Not getting found"], 1.0)
    problems = []
    for name in PROBLEMS:
        confidence = min(1.0, len(evidence[name]) / 2)
        effort = 1.0 if name in ("Bad or no data", "Losing leads") else 1.5
        cost = severity[name] * 10
        value = round(cost * confidence / effort, 4)
        problems.append({"name": name, "evidence": evidence[name], "severity": round(severity[name], 4),
                         "effort": effort, "score": value})
    problems.sort(key=lambda x: (-x["score"], x["name"]))
    overall = min(100, round(sum(p["score"] for p in problems) * 2))
    return {"overall_score": overall, "problems": problems,
            "section_scores": {"questions": overall, "automated": 0}}


def findings(result: dict[str, Any]) -> list[str]:
    out = []
    for problem in result["problems"]:
        if problem["evidence"]:
            out.append(f"{problem['name']}: {problem['evidence'][0]}.")
        if len(out) == 3:
            break
    while len(out) < 3:
        out.append("More evidence is needed before recommending a system.")
    return out

