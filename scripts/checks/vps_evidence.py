"""Explicit user-supplied VPS results; never presented as local HTTP observations."""
import datetime
import json
import re
import subprocess
from pathlib import Path


def load_dev_portal_evidence(path, expected_url):
    record = json.loads(Path(path).read_text())["checks"]["0.7"]
    if record.get("source") != "user_mac_terminal":
        raise ValueError("source must be user_mac_terminal")
    if record.get("url", "").rstrip("/") != expected_url.rstrip("/"):
        raise ValueError("evidence URL does not match DEV_PORTAL_URL")
    if record.get("http_status") != 200:
        raise ValueError("evidence must report HTTP 200")
    observed = datetime.date.fromisoformat(record["observed_on"])
    age = (datetime.datetime.now(datetime.timezone.utc).date() - observed).days
    if not 0 <= age <= 7:
        raise ValueError("evidence must be dated within the last seven days")
    revision = record.get("deployed_revision", "")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("invalid deployed revision")
    result = subprocess.run(["git", "merge-base", "--is-ancestor", revision, "HEAD"], capture_output=True)
    if result.returncode:
        raise ValueError("deployed revision is not in this branch history")
    if "PASS 0.7" not in record.get("reported_output", ""):
        raise ValueError("missing reported check output")
    return revision
