from ..models import CheckResult


def inspect_signals(html: str) -> CheckResult:
    lower = html.lower()
    return CheckResult("ok", {"contact_form": "<form" in lower,
        "click_to_call": "tel:" in lower, "booking": any(x in lower for x in ("book", "schedule"))})

