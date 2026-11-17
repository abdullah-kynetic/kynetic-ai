import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from ..models import CheckResult

UNLIGHTHOUSE_VERSION = "0.19.1"
logger = logging.getLogger(__name__)


def discover_chrome() -> str | None:
    for env in ("UNLIGHTHOUSE_CHROME_PATH", "CHROME_PATH", "PUPPETEER_EXECUTABLE_PATH"):
        value = os.getenv(env, "").strip()
        if value and Path(value).is_file():
            return value
    for name in ("chromium", "google-chrome", "google-chrome-stable", "chromium-browser", "chrome"):
        path = shutil.which(name)
        if path:
            return path
    matches: list[Path] = []
    for root in (Path.home() / ".cache/ms-playwright", Path("/root/.cache/ms-playwright")):
        if root.is_dir():
            matches.extend(root.glob("chromium-*/chrome-linux64/chrome"))
            matches.extend(root.glob("chromium-*/chrome-linux/chrome"))
    return str(sorted(matches)[-1]) if matches else None


def unlighthouse_command(website: str, output_path: str = "/tmp/unlighthouse",
                         config_path: str | None = None) -> list[str]:
    command = ["unlighthouse-ci", "--site", website, "--output-path", output_path,
               "--reporter", "jsonExpanded", "--no-cache"]
    if config_path:
        command.extend(["--config-file", config_path])
    return command


def write_unlighthouse_config(path: Path, max_routes: int = 15, chrome_path: str | None = None) -> Path:
    chrome = chrome_path if chrome_path is not None else discover_chrome()
    config: dict[str, object] = {
        "scanner": {"maxRoutes": max_routes, "device": "mobile"},
        "puppeteerClusterOptions": {"maxConcurrency": 2},
    }
    if chrome:
        config["puppeteerOptions"] = {
            "executablePath": chrome,
            "args": ["--no-sandbox", "--disable-dev-shm-usage"],
        }
    path.write_text("export default " + json.dumps(config, indent=2) + ";\n")
    return path


def parse_summary(raw: str) -> dict:
    payload = json.loads(raw)
    if isinstance(payload, dict) and "pages" in payload and "score" in payload:
        return {"pages": min(15, int(payload["pages"])), "score": payload["score"], "label": "site-wide estimate"}
    routes: list[dict] = []
    category_scores: dict[str, list[float]] = {}
    if isinstance(payload, list):
        routes = [row for row in payload if isinstance(row, dict)]
        for row in routes:
            for key, value in row.items():
                if key in {"path", "score"} or not isinstance(value, (int, float)) or isinstance(value, bool):
                    continue
                category_scores.setdefault(key, []).append(float(value))
    elif isinstance(payload, dict) and isinstance(payload.get("summary"), dict):
        routes = [row for row in (payload.get("routes") or []) if isinstance(row, dict)]
        categories = payload["summary"].get("categories") or {}
        if isinstance(categories, dict):
            for key, value in categories.items():
                if isinstance(value, dict) and isinstance(value.get("score"), (int, float)):
                    category_scores[key] = [float(value["score"])]
                elif isinstance(value, (int, float)) and not isinstance(value, bool):
                    category_scores[key] = [float(value)]
    else:
        raise ValueError("unrecognized Unlighthouse summary")
    if not routes and not category_scores:
        raise ValueError("Unlighthouse summary contained no pages")
    score = {key: (values[0] if len(values) == 1 else round(sum(values) / len(values), 2))
             for key, values in category_scores.items()}
    return {"pages": min(15, len(routes) or 0), "score": score, "label": "site-wide estimate"}


def run_unlighthouse(mode: str, website: str) -> CheckResult:
    if mode != "full":
        return CheckResult("skipped", reason="Unlighthouse is full-audit only")
    output_dir = None
    try:
        version_result = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=5, check=True)
        version = (version_result.stdout or "").strip()
        logger.info("Unlighthouse Node version: %s", version or "unknown")
        match = re.match(r"v(\d+)", version)
        if not match or int(match.group(1)) < 22:
            return CheckResult("couldnt_check", reason=f"Unlighthouse requires Node 22+, found {version or 'unknown'}")
        output_dir = tempfile.mkdtemp(prefix="unlighthouse-")
        config_path = write_unlighthouse_config(Path(output_dir) / "unlighthouse.config.mjs")
        chrome = discover_chrome()
        env = os.environ.copy()
        if chrome:
            env.setdefault("PUPPETEER_EXECUTABLE_PATH", chrome)
            env.setdefault("CHROME_PATH", chrome)
        completed = subprocess.run(
            unlighthouse_command(website, output_dir, str(config_path)),
            capture_output=True, text=True, timeout=90, check=False, env=env, cwd=output_dir,
        )
        result_path = Path(output_dir) / "ci-result.json"
        if result_path.is_file():
            return CheckResult("ok", parse_summary(result_path.read_text()))
        if completed.returncode != 0:
            stderr = (completed.stderr or completed.stdout or "").strip()[-1000:]
            return CheckResult("couldnt_check", reason=f"Unlighthouse failed: CalledProcessError: {stderr or 'no stderr'}")
        raise FileNotFoundError("ci-result.json was not written")
    except FileNotFoundError as exc:
        detail = str(exc)
        if "ci-result.json" in detail:
            return CheckResult("couldnt_check", reason=f"Unlighthouse failed: FileNotFoundError: {detail}")
        return CheckResult("couldnt_check", reason="Node 22+ or Unlighthouse is unavailable")
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()[-1000:]
        return CheckResult("couldnt_check", reason=f"Unlighthouse failed: {type(exc).__name__}: {stderr or 'no stderr'}")
    except (subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, ValueError) as exc:
        detail = getattr(exc, "stderr", "") or str(exc)
        return CheckResult("couldnt_check", reason=f"Unlighthouse failed: {type(exc).__name__}: {str(detail)[-1000:]}")
    finally:
        if output_dir:
            shutil.rmtree(output_dir, ignore_errors=True)
