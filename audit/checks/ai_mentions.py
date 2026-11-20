import random
import re
import time
from typing import Any, Callable, Iterable
from ..config import require_free_model
from ..models import CheckResult

PROMPTS = (
    "Which {industry} companies in {city}, {state} would you recommend? List up to 5 business names, one per line, names only.",
    "I need a reliable {industry} near {city}, {state}. Who are the best-known local options? List up to 5 business names, one per line.",
    "Top rated {industry} in {city}, {state}: list up to 5 business names, one per line, names only.",
)


class OpenRouterError(Exception):
    def __init__(self, status: int, message: str = "provider error") -> None:
        super().__init__(message)
        self.status = status


class EmptyModelContent(ValueError):
    """The provider returned no usable assistant content."""


# 404 is treated as a missing/retired free model so the next fallback can run.
_RETRYABLE_STATUS = {404, 408, 409, 425, 429}


def parse_answer(answer: str | None, business_name: str) -> dict[str, Any]:
    if not isinstance(answer, str) or not answer.strip():
        raise EmptyModelContent("model returned empty content")
    from .maps import similar
    names = []
    for line in answer.splitlines():
        clean = re.sub(r"^\s*(?:\d+[.)]|[-*\u2022])\s*", "", line).strip().strip("*").strip()
        clean = re.split(r"\s+[-\u2013\u2014:]\s+|\s*\(", clean)[0].strip().strip("*")
        if 2 < len(clean) < 80 and not clean.endswith(("?", ":")) and len(clean.split()) <= 8:
            names.append(clean)
    mentioned = business_name.lower() in answer.lower() or any(similar(business_name, n) >= 0.6 for n in names)
    competitors = [n for n in names if similar(business_name, n) < 0.6][:5]
    return {"mentioned": mentioned, "competitors_named": competitors, "citations": [],
            "label": "model recall, not live search"}


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
            prompts = [prompt.format(**business) for prompt in PROMPTS]
            answers = [parse_answer(ask(model, prompt), business["name"]) for prompt in prompts]
            named: dict[str, int] = {}
            for answer in answers:
                for name in answer["competitors_named"]:
                    named[name] = named.get(name, 0) + 1
            hits = sum(1 for a in answers if a["mentioned"])
            return CheckResult("ok", {"model": model, "prompts": prompts, "answers": answers,
                                       "mentioned_in": hits, "asked": len(answers),
                                       "others_named": sorted(named, key=lambda n: (-named[n], n))[:6],
                                       "label": "model recall, not live search",
                                       "models_tried": models_tried + [{"model": model, "status": 200}]},
                               tool="AI assistant answers (OpenRouter free model)", observed_at=_now())
        except OpenRouterError as exc:
            last_reason = f"OpenRouter {model} returned HTTP {exc.status}"
            models_tried.append({"model": model, "status": exc.status})
            if exc.status in _RETRYABLE_STATUS or exc.status >= 500:
                sleep(min(0.8, 0.2 + random.random() * 0.2))
                continue
            break
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
    return CheckResult("couldnt_check", data={"models_tried": models_tried}, reason=last_reason,
                       tool="AI assistant answers (OpenRouter free model)", observed_at=_now())


def _now() -> str:
    from ..net import now_iso
    return now_iso()

