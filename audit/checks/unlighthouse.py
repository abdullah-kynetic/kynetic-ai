import json
import subprocess
from ..models import CheckResult


def parse_summary(raw: str) -> dict:
    payload = json.loads(raw)
    return {"pages": min(15, int(payload["pages"])), "score": payload["score"], "label": "site-wide estimate"}


def run_unlighthouse(mode: str, website: str) -> CheckResult:
    if mode != "full": return CheckResult("skipped", reason="Unlighthouse is full-audit only")
    try:
        completed = subprocess.run(["npx", "unlighthouse", "--site", website, "--max-routes", "15", "--outputPath", "/tmp/unlighthouse"],
                                   capture_output=True, text=True, timeout=90, check=True)
        return CheckResult("ok", parse_summary(completed.stdout))
    except FileNotFoundError:
        return CheckResult("couldnt_check", reason="Node or Unlighthouse is unavailable")
    except (subprocess.SubprocessError, json.JSONDecodeError, KeyError, ValueError) as exc:
        return CheckResult("couldnt_check", reason=f"Unlighthouse failed: {type(exc).__name__}")
