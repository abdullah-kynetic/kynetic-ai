from collections.abc import Callable
from typing import Any
from ..models import CheckResult


def run_full_only(mode: str, name: str, runner: Callable[[], dict[str, Any] | CheckResult]) -> CheckResult:
    if mode != "full":
        return CheckResult("skipped", reason=f"{name} is full-audit only")
    try:
        result = runner()
        if isinstance(result, CheckResult):
            return result
        return CheckResult("ok", result)
    except Exception as exc:
        return CheckResult("couldnt_check", reason=f"{type(exc).__name__}: {str(exc) or 'full-only check failed'}")


def run_operator_only(mode: str, runner: Callable[[], dict[str, Any]]) -> CheckResult:
    if mode != "operator":
        return CheckResult("skipped", {"reason": "operator-only adapter"})
    try:
        return CheckResult("ok", runner())
    except Exception:
        return CheckResult("couldnt_check")

