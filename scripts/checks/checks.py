#!/usr/bin/env python3
"""Kynetic step checks. Read-only. Never prints secret values."""
import argparse, json, os, re, subprocess, sys, glob, urllib.request, urllib.error
from vps_evidence import load_dev_auth_evidence, load_dev_portal_evidence
from portal_check import check_dev_portal
from pathlib import Path

LIVE_ALEX = "agent_8201m5afn2rbeb7v29xfkhh1pjef"
N8N = "https://n8n.kyneticai.com"
TWENTY = "https://crm.kyneticai.com"
R = {"PASS": 0, "FAIL": 0, "SKIP": 0}
VPS_EVIDENCE = None

def out(s, cid, msg): R[s] += 1; print(f"{s:4} {cid} {msg}")
def ok(cid, cond, msg, fail="not built"): out("PASS" if cond else "FAIL", cid, msg if cond else f"{msg}: {fail}")
def env(*n): return all(os.environ.get(x) for x in n)

def get(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": "kynetic-checks", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, b""
    except Exception as e: return 0, str(type(e).__name__).encode()

def http_check(cid, msg, url, need=(), headers=None, want=200):
    if need and not env(*need): return out("SKIP", cid, f"{msg}: missing {','.join(need)}")
    code, _ = get(url, headers)
    ok(cid, code == want, msg, f"HTTP {code}")

def npm(cid, script, *args):
    if not Path("crm/node_modules").exists():
        r = subprocess.run(["bun", "install", "--frozen-lockfile"], cwd="crm", capture_output=True)
        if r.returncode: return out("FAIL", cid, "bun install failed")
    r = subprocess.run(["bun", "run", script, *args], cwd="crm", capture_output=True, text=True, env={**os.environ, "SKIP_ENV_VALIDATION": "1"})
    ok(cid, r.returncode == 0, f"crm {script} {' '.join(args)}".strip(), (r.stdout + r.stderr).strip()[-300:])

def dev_wfs(): return sorted(glob.glob("n8n/workflows/dev/*.json"))

PHONE = re.compile(r"\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
def wf_issues(p):
    try: d = json.load(open(p))
    except Exception: return ["invalid JSON"]
    iss = []
    if not str(d.get("name", "")).startswith("DEV -"): iss.append("name not 'DEV -'")
    tags = [t.get("name", t) if isinstance(t, dict) else t for t in d.get("tags", [])]
    if "DEV" not in tags: iss.append("no DEV tag")
    if d.get("active"): iss.append("active=true")
    txt = json.dumps(d.get("nodes", []))
    if PHONE.search(re.sub(r'"(id|webhookId|typeVersion)":\s*"[^"]*"', "", txt)): iss.append("hardcoded phone-like number")
    return iss

def el(path, key="ELEVENLABS_API_KEY_blitz"):
    code, body = get(f"https://api.elevenlabs.io{path}", {"xi-api-key": os.environ.get(key, "")})
    return code, (json.loads(body) if code == 200 else {})

def s0():
    need = ["n8n_vps", "CAL_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "ELEVENLABS_API_KEY_blitz", "TEST_PHONE"]
    miss = [n for n in need if not os.environ.get(n)]
    ok("0.1", not miss, "required env present", "missing " + ",".join(miss))
    p = Path("crm/.env.dev.example")
    ok("0.2", p.exists(), "crm/.env.dev.example")
    ok("0.3", bool(dev_wfs()), "n8n/workflows/dev/*.json")
    bad = {Path(p).name: wf_issues(p) for p in dev_wfs()}; bad = {k: v for k, v in bad.items() if v}
    if not dev_wfs(): out("FAIL", "0.4", "dev workflow hygiene: not built")
    else: ok("0.4", not bad, "dev workflow hygiene", json.dumps(bad))
    http_check("0.5", "n8n API reachable", f"{N8N}/api/v1/workflows?limit=1", ["n8n_vps"], {"X-N8N-API-KEY": os.environ.get("n8n_vps", "")})
    if not env("ELEVENLABS_API_KEY_blitz"): out("SKIP", "0.6", "DEV agent on Blitz: missing key")
    else:
        c, d = el("/v1/convai/agents?page_size=100")
        names = [a.get("name", "") for a in d.get("agents", [])]
        ok("0.6", any(n.startswith("DEV-") for n in names), "DEV- agent on Blitz", f"HTTP {c}, none named DEV-" if c == 200 else f"HTTP {c}")
    if VPS_EVIDENCE:
        try:
            revision = load_dev_portal_evidence(VPS_EVIDENCE, os.environ.get("DEV_PORTAL_URL", ""))
            out("PASS", "0.7", f"dev portal HTTP 200 — USER MAC EVIDENCE, deployed {revision[:12]}; not checked from this executor")
        except (ValueError, KeyError, OSError):
            out("FAIL", "0.7", "invalid or stale user-supplied VPS evidence")
    elif env("DEV_PORTAL_URL"): http_check("0.7", "dev portal up", os.environ["DEV_PORTAL_URL"])
    else: out("FAIL", "0.7", "dev portal up: DEV_PORTAL_URL not set (not built)")

def s1():
    for cid, s in [("1.1", "typecheck"), ("1.2", "lint"), ("1.3", "test"), ("1.4", "build")]: npm(cid, s)
    c = Path("crm/src/server/consent")
    have = {"consent": (c / "can-contact.ts").exists(), "quiet-hours": (c / "quiet-hours.ts").exists(),
            "kill-switch": c.exists() and bool(re.search(r"kill.?switch", (c / "can-contact.ts").read_text(), re.I))}
    ok("1.5", all(have.values()), "safety logic in crm/src/server/consent", "missing " + ",".join(k for k, v in have.items() if not v))
    t = ["tests/unit/quiet-hours.test.ts", "tests/unit/contact-consent-status.test.ts", "tests/unit/kill-switch.test.ts"]
    miss = [x for x in t if not Path("crm", x).exists()]
    if miss: out("FAIL", "1.6", "safety unit tests: not built " + ",".join(miss))
    else: npm("1.6", "test", *t)
    if not env("DEV_PORTAL_URL"):
        out("FAIL", "1.7", "dev portal auth: DEV_PORTAL_URL not set")
    elif VPS_EVIDENCE:
        try:
            root, admin, revision = load_dev_auth_evidence(VPS_EVIDENCE, os.environ["DEV_PORTAL_URL"])
            out("PASS", "1.7", f"DEV auth — USER MAC EVIDENCE: root {root}, /admin {admin}; checker {revision[:12]}; not checked from this executor or proof of deployment")
        except (ValueError, KeyError, OSError, TypeError):
            out("FAIL", "1.7", "invalid or stale user-supplied dev auth evidence")
    else:
        try:
            passed, root, admin = check_dev_portal(os.environ["DEV_PORTAL_URL"])
            ok("1.7", passed, "DEV portal up; anonymous admin denied or redirected to sign-in", f"root {root}, /admin {admin}")
        except ValueError:
            out("FAIL", "1.7", "invalid dev target; refusing production or non-dev URL")
    files = subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout.split()
    pat = re.compile(r"(sk_live_[A-Za-z0-9]{20,}|xi-api-key\s*[:=]\s*['\"][a-z0-9]{20,}|AC[0-9a-f]{32}|eyJhbGciOi[A-Za-z0-9_-]{30,}\.)")
    hits = []
    for f in files:
        if "/tests/" in f or f.endswith((".png", ".jpg", ".ico", ".woff2", ".lock")) or "package-lock" in f: continue
        try:
            if pat.search(Path(f).read_text(errors="ignore")): hits.append(f)
        except Exception: pass
    ok("1.8", not hits, "no secrets in tracked files", "suspect: " + ",".join(hits[:10]))

def s2():
    t = Path("providers/elevenlabs/templates/alex.json")
    ok("2.1", t.exists() and LIVE_ALEX not in t.read_text(), "Alex template (no live id)")
    if not env("ELEVENLABS_API_KEY_blitz"): out("SKIP", "2.2", "DEV Alex number: missing key")
    else:
        c, d = el("/v1/convai/phone-numbers")
        items = d if isinstance(d, list) else []
        ok("2.2", any((p.get("assigned_agent") or {}).get("agent_name", "").startswith("DEV-") for p in items), "phone number on DEV- agent", f"HTTP {c}")
    hit = [p for p in dev_wfs() if "ElevenLabs Speed to Lead" in Path(p).read_text()]
    ok("2.3", bool(hit) and all(k in Path(hit[0]).read_text() for k in ("project_type", "budget")), "DEV ElevenLabs speed-to-lead wf with project_type+budget")
    http_check("2.4", "Cal.com API reachable", "https://api.cal.com/v2/me", ["CAL_API_KEY"], {"Authorization": f"Bearer {os.environ.get('CAL_API_KEY','')}", "cal-api-version": "2024-08-13"})
    if not env("ELEVENLABS_API_KEY_blitz"): out("SKIP", "2.5", "live Alex readable: missing key")
    else:
        c, _ = el(f"/v1/convai/agents/{LIVE_ALEX}"); ok("2.5", c == 200, "live Alex readable (unchanged)", f"HTTP {c}")

def s3():
    ok("3.1", bool(glob.glob("crm/src/app/api/hooks/leads/**/route.*", recursive=True)), "lead intake route")
    if not glob.glob("crm/tests/unit/chain/*"): out("FAIL", "3.2", "chain tests crm/tests/unit/chain: not built")
    else: npm("3.2", "test", "tests/unit/chain")
    hit = [p for p in dev_wfs() if re.search(r"retry|retryOnFail|errorWorkflow", Path(p).read_text())]
    ok("3.3", bool(hit), "dev workflow retry/error handling")
    http_check("3.4", "Twenty reachable", f"{TWENTY}/rest/companies?limit=1", ["TWENTY_API_KEY"], {"Authorization": f"Bearer {os.environ.get('TWENTY_API_KEY','')}"})

def s4():
    names = " ".join(Path(p).name.lower() for p in dev_wfs())
    miss = [k for k in ("missed-call", "reminder", "owner-alert", "error-alert") if k not in names]
    ok("4.1", not miss, "texts/alerts dev workflows", "missing " + ",".join(miss))
    bad = [Path(p).name for p in dev_wfs() if "hardcoded phone-like number" in wf_issues(p)]
    if not dev_wfs(): out("FAIL", "4.2", "SMS targets TEST_PHONE only: not built")
    else: ok("4.2", not bad, "SMS targets TEST_PHONE only", ",".join(bad))
    if not env("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"): out("SKIP", "4.3", "Twilio reachable: missing creds")
    else:
        import base64
        a = base64.b64encode(f"{os.environ['TWILIO_ACCOUNT_SID']}:{os.environ['TWILIO_AUTH_TOKEN']}".encode()).decode()
        c, _ = get(f"https://api.twilio.com/2010-04-01/Accounts/{os.environ['TWILIO_ACCOUNT_SID']}.json", {"Authorization": "Basic " + a})
        ok("4.3", c == 200, "Twilio reachable", f"HTTP {c}")

def s5():
    for i, f in enumerate(["proposal", "contract", "invoice", "checklist", "workspace"], 1):
        p = Path(f"docs/onboarding/{f}.md"); ok(f"5.{i}", p.exists() and p.stat().st_size > 200, f"docs/onboarding/{f}.md")

def s6():
    for cid, f in [("6.1", "walkthrough"), ("6.2", "email-dns")]:
        p = Path(f"docs/onboarding/{f}.md"); ok(cid, p.exists() and p.stat().st_size > 200, f"docs/onboarding/{f}.md")
    out("SKIP", "6.3", "full live test: MANUAL, needs Abdullah's yes — stop here")

STEPS = [s0, s1, s2, s3, s4, s5, s6]
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("step", nargs="?", default="all", choices=["all", *map(str, range(7))])
    parser.add_argument("--vps-evidence", help="Explicit user-reported Mac evidence for checks 0.7 and 1.7")
    args = parser.parse_args()
    a = args.step
    VPS_EVIDENCE = args.vps_evidence
    for i in (range(7) if a == "all" else [int(a)]):
        print(f"== step {i} =="); STEPS[i]()
    print(f"PASS={R['PASS']} FAIL={R['FAIL']} SKIP={R['SKIP']}")
    sys.exit(1 if R["FAIL"] else 0)
