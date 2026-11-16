from typing import Any, Callable
from ..config import require_free_model
from ..models import CheckResult

PROMPTS = (
    "best {industry} in {city}",
    "best {industry} near {city}",
    "top {industry} in {city}",
)


def parse_answer(answer: str, business_name: str) -> dict[str, Any]:
    lower = answer.lower()
    return {"mentioned": business_name.lower() in lower,
            "competitors_named": [], "citations": [], "label": "model recall, not live search"}


def check_mentions(business: dict[str, str], model: str, ask: Callable[[str, str], str]) -> CheckResult:
    try:
        require_free_model(model)
        parsed = [parse_answer(ask(model, prompt.format(**business)), business["name"])
                  for prompt in PROMPTS]
        return CheckResult("ok", {"prompts": list(PROMPTS), "answers": parsed,
                                   "label": "model recall, not live search"})
    except (ValueError, KeyError, TimeoutError):
        return CheckResult("couldnt_check")

