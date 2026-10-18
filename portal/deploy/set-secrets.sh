#!/bin/bash
# Run ON THE SERVER:  ssh -t ubuntu@40.160.150.91 /opt/portal/set-secrets.sh
# Prompts (hidden input) for the Resend and R2 settings, writes them into /opt/portal/.env (chmod 600),
# and restarts the app. Leave a prompt blank to keep its current value. Nothing is echoed or logged.
set -euo pipefail
ENVF=/opt/portal/.env
[ -f "$ENVF" ] || { echo "missing $ENVF" >&2; exit 1; }
setkv() { # key value
  KEY="$1" VAL="$2" python3 - "$ENVF" <<'PY'
import os, sys
p, k, v = sys.argv[1], os.environ["KEY"], os.environ["VAL"]
lines = open(p).read().splitlines()
out, done = [], False
for l in lines:
    if l.startswith(k + "="):
        out.append(f"{k}={v}"); done = True
    else:
        out.append(l)
if not done: out.append(f"{k}={v}")
open(p, "w").write("\n".join(out) + "\n")
PY
}
ask() { # key label [secret]
  local v
  if [ "${3:-}" = "secret" ]; then read -r -s -p "$2 (hidden, blank = keep): " v; echo; else read -r -p "$2 (blank = keep): " v; fi
  [ -n "$v" ] && { setkv "$1" "$v"; echo "  set $1"; }
  return 0
}
echo "== Resend =="
ask RESEND_API_KEY "Resend API key (starts with re_)" secret
ask EMAIL_FROM "From address, e.g. Kynetic AI <portal@notify.kyneticai.com>"
echo "== Google sign-in (optional) =="
ask AUTH_GOOGLE_ID "Google OAuth client id"
ask AUTH_GOOGLE_SECRET "Google OAuth client secret" secret
echo "== Cloudflare R2 =="
ask R2_ACCOUNT_ID "R2 account id"
ask R2_BUCKET "R2 bucket name"
ask R2_ACCESS_KEY_ID "R2 access key id"
ask R2_SECRET_ACCESS_KEY "R2 secret access key" secret
chmod 600 "$ENVF"
echo "Restarting the portal app..."
cd /opt/portal && sudo docker compose up -d --force-recreate portal-app >/dev/null 2>&1
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:3020/api/health >/dev/null 2>&1 && { echo "portal is healthy"; break; }; sleep 2; done
echo "Active settings: google=$([ -n "$(grep '^AUTH_GOOGLE_SECRET=.' $ENVF)" ] && echo on || echo off)  resend=$([ -n "$(grep '^RESEND_API_KEY=.' $ENVF)" ] && echo on || echo off)  r2=$([ -n "$(grep '^R2_SECRET_ACCESS_KEY=.' $ENVF)" ] && echo on || echo off)"
