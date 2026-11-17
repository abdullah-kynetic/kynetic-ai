import random
import time
from typing import Any, Callable, Iterable
from ..config import require_free_model
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


class EmptyModelContent(ValueError):
    """The provider returned no usable assistant content."""


def parse_answer(answer: str | None, business_name: str) -> dict[str, Any]:
    if not isinstance(answer, str) or not answer.strip():
        raise EmptyModelContent("model returned empty content")
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
    models_tried: list[dict[str, object]] = []
    for model in models:
        if clock() - started >= budget_s:
            break
        try:
            require_free_model(model)
            answers = [parse_answer(ask(model, prompt.format(**business)), business["name"]) for prompt in PROMPTS]
            return CheckResult("ok", {"model": model, "prompts": list(PROMPTS), "answers": answers,
                                       "label": "model recall, not live search", "models_tried": models_tried + [{"model": model, "status": 200}]})
        except OpenRouterError as exc:
            last_reason = f"OpenRouter {model} returned HTTP {exc.status}"
            models_tried.append({"model": model, "status": exc.status})
            if exc.status not in (429,) and exc.status < 500:
                break
            sleep(min(0.8, 0.2 + random.random() * 0.2))
        except EmptyModelContent as exc:
            last_reason = f"OpenRouter {model}: {exc}"
            models_tried.append({"model": model, "status": "empty"})
            continue
        except Exception as exc:
            last_reason = f"OpenRouter {type(exc).__name__}: {str(exc) or 'request failed'}"
            models_tried.append({"model": model, "status": 0})
            break
    if not models_tried:
        last_reason = "OpenRouter model budget exhausted before a model was attempted"
    return CheckResult("couldnt_check", data={"models_tried": models_tried}, reason=last_reason)

