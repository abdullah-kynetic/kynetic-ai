"""Data shapes shared by checks, scoring, findings and the report."""

from dataclasses import dataclass, field
from typing import Any, Literal

Mode = Literal["free", "full", "operator"]
Status = Literal["ok", "couldnt_check", "skipped"]
Severity = Literal["high", "medium", "low"]


@dataclass(frozen=True)
class Business:
    name: str
    website: str
    city: str
    state: str
    industry: str
    phone: str = ""
    address: str = ""


@dataclass(frozen=True)
class AuditRequest:
    mode: Mode
    business: Business
    answers: dict[str, str] = field(default_factory=dict)
    idempotency_key: str = ""
    callback_url: str = ""
    lead: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class CheckResult:
    """One tool's output.

    ``data`` is the structured evidence. ``tool`` names the provider, ``sources`` lists the public URLs
    read, and ``observed_at`` is the UTC time the evidence was collected. ``couldnt_check`` never carries
    a guess: the report shows the reason instead.
    """

    status: Status
    data: dict[str, Any] = field(default_factory=dict)
    cost_cents: int = 0
    ms: int = 0
    reason: str | None = None
    tool: str = ""
    sources: tuple[str, ...] = ()
    observed_at: str = ""


@dataclass(frozen=True)
class Item:
    """A single pass/warn/fail line inside a check (for example "Meta description present")."""

    key: str
    label: str
    status: Literal["pass", "warn", "fail", "info", "unknown"]
    value: str = ""
    note: str = ""
    weight: float = 1.0


@dataclass(frozen=True)
class Finding:
    id: str
    category: str
    severity: Severity
    title: str
    observed: str
    why: str
    fix: str
    service: str
    tool: str
    source: str = ""
