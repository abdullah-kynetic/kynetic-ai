from typing import Callable
from ..models import CheckResult


def run_full_only(mode: str, name: str, runner: Callable[[], dict]) -> CheckResult:
    if mode != "full":
        return CheckResult("skipped", {"reason": f"{name} is full-audit only"})
    try:
        return CheckResult("ok", runner())
    except Exception:
        return CheckResult("couldnt_check")


def run_operator_only(mode: str, runner: Callable[[], dict]) -> CheckResult:
    if mode != "operator":
        return CheckResult("skipped", {"reason": "operator-only adapter"})
    try:
        return CheckResult("ok", runner())
    except Exception:
        return CheckResult("couldnt_check")

