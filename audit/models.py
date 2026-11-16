from dataclasses import dataclass, field
from typing import Any, Literal

Mode = Literal["free", "full", "operator"]
Status = Literal["ok", "couldnt_check", "skipped"]


@dataclass(frozen=True)
class Business:
    name: str
    website: str
    city: str
    state: str
    industry: str


@dataclass(frozen=True)
class AuditRequest:
    mode: Mode
    business: Business
    answers: dict[str, str] = field(default_factory=dict)
    idempotency_key: str = ""


@dataclass(frozen=True)
class CheckResult:
    status: Status
    data: dict[str, Any] = field(default_factory=dict)
    cost_cents: int = 0
    ms: int = 0

