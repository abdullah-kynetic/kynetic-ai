import random
import time
from typing import Any, Callable, Iterable
from ..config import free_models_from_catalog, require_free_model
from ..models import CheckResult

PROMPTS = (
    "best {industry} in {city}",
    "best {industry} near {city}",
    "top {industry} in {city}",
)


class OpenRouterError(Exception):
    def __init__(self, status: int, message: str = "provider error") -> None:
        super().__init__(message)
        self.status = status


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
        return CheckResult("couldnt_check", reason="OpenRouter model request failed")


def check_mentions_with_fallback(business: dict[str, str], models: Iterable[str],
                                  ask: Callable[[str, str], str], sleep: Callable[[float], None] = time.sleep,
                                  budget_s: float = 20.0, clock: Callable[[], float] = time.monotonic) -> CheckResult:
    started = clock()
    last_reason = "OpenRouter model request failed"
    for model in models:
        if clock() - started >= budget_s:
            break
        try:
            require_free_model(model)
            answers = [parse_answer(ask(model, prompt.format(**business)), business["name"]) for prompt in PROMPTS]
            return CheckResult("ok", {"model": model, "prompts": list(PROMPTS), "answers": answers,
                                       "label": "model recall, not live search"})
        except OpenRouterError as exc:
            last_reason = f"OpenRouter {model} returned HTTP {exc.status}"
            if exc.status not in (429,) and exc.status < 500:
                break
            sleep(min(0.8, 0.2 + random.random() * 0.2))
        except (ValueError, KeyError, TimeoutError) as exc:
            last_reason = f"OpenRouter {type(exc).__name__}"
            break
    return CheckResult("couldnt_check", reason=last_reason)

