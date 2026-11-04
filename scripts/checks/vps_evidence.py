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


def load_dev_auth_evidence(path, expected_url):
    from portal_check import admin_is_blocked
    from urllib.parse import urlsplit

    record = json.loads(Path(path).read_text())["checks"]["1.7"]
    target = urlsplit(expected_url)
    if (target.scheme != 'https' or target.hostname != 'dev.kyneticai.com'
            or target.port not in (None, 443) or target.username or target.password
            or target.path not in ('', '/') or target.query or target.fragment):
        raise ValueError('invalid dev target')
    if record.get('source') != 'user_mac_terminal' or record.get('url', '').rstrip('/') != expected_url.rstrip('/'):
        raise ValueError('wrong evidence provenance or target')
    age = (datetime.datetime.now(datetime.timezone.utc).date() - datetime.date.fromisoformat(record['observed_on'])).days
    if not 0 <= age <= 7:
        raise ValueError('stale evidence')
    revision = record.get('checker_revision', '')
    if not re.fullmatch(r'[0-9a-f]{40}', revision) or subprocess.run(
            ['git', 'merge-base', '--is-ancestor', revision, 'HEAD'], capture_output=True).returncode:
        raise ValueError('invalid checker revision')
    headers = {k.lower(): v for k, v in record.get('request_headers', {}).items()}
    expected_headers = {'accept': '*/*', 'accept-encoding': 'identity', 'connection': 'close',
                        'host': target.netloc, 'user-agent': 'kynetic-checks'}
    if headers != expected_headers or record.get('method') != 'GET' or record.get('follow_redirects') is not False:
        raise ValueError('evidence does not match unauthenticated checker request')
    root, admin = record['root_http_status'], record['admin_http_status']
    if root not in (200, 302, 303, 307, 308) or not admin_is_blocked(
            admin, record.get('admin_location', ''), expected_url.rstrip('/') + '/admin'):
        raise ValueError('reported HTTP statuses do not meet the assertion')
    if 'PASS 1.7' not in record.get('reported_output', ''):
        raise ValueError('missing reported output')
    return root, admin, revision
