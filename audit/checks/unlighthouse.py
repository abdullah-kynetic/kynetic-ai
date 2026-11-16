import json
import subprocess
from ..models import CheckResult

UNLIGHTHOUSE_VERSION = "0.15.2"


def unlighthouse_command(website: str, output_path: str = "/tmp/unlighthouse") -> list[str]:
    return ["npx", "--yes", f"unlighthouse@{UNLIGHTHOUSE_VERSION}", "--site", website,
            "--max-routes", "15", "--outputPath", output_path]


def parse_summary(raw: str) -> dict:
    payload = json.loads(raw)
    return {"pages": min(15, int(payload["pages"])), "score": payload["score"], "label": "site-wide estimate"}


def run_unlighthouse(mode: str, website: str) -> CheckResult:
    if mode != "full": return CheckResult("skipped", reason="Unlighthouse is full-audit only")
    try:
        completed = subprocess.run(unlighthouse_command(website),
                                   capture_output=True, text=True, timeout=90, check=True)
        return CheckResult("ok", parse_summary(completed.stdout))
    except FileNotFoundError:
        return CheckResult("couldnt_check", reason="Node or Unlighthouse is unavailable")
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()[-1000:]
        return CheckResult("couldnt_check", reason=f"Unlighthouse failed: {type(exc).__name__}: {stderr or 'no stderr'}")
    except (subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, ValueError) as exc:
        detail = getattr(exc, "stderr", "") or str(exc)
        return CheckResult("couldnt_check", reason=f"Unlighthouse failed: {type(exc).__name__}: {str(detail)[-1000:]}")
