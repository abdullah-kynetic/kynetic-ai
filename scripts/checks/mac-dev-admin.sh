#!/usr/bin/env bash
# Read-only dev investigation. No production URLs, credentials, cookies or server changes.
set -euo pipefail
command -v python3 >/dev/null
base="${DEV_PORTAL_URL:-https://dev.kyneticai.com}"
python3 - "$base" <<'PY'
import sys
from urllib.parse import urlsplit
u=urlsplit(sys.argv[1])
if u.scheme != 'https' or u.hostname != 'dev.kyneticai.com' or u.port not in (None,443) or u.username or u.password or u.query or u.fragment or u.path not in ('','/'):
    raise SystemExit('Refusing target other than https://dev.kyneticai.com')
PY
url="${base%/}/admin"
# Disable curlrc; use no cookies, session or auth headers.
first="$(curl -q -s --show-error --max-time 30 -o /dev/null -w '%{http_code} %{redirect_url}\n' "$url")"
printf 'NO_FOLLOW %s\n' "$first"
# Refuse a redirect to a different site rather than investigating production.
python3 - "$first" <<'PY'
import sys
from urllib.parse import urlsplit
parts=sys.argv[1].split(maxsplit=1)
if len(parts)>1:
    u=urlsplit(parts[1])
    if u.scheme!='https' or u.hostname!='dev.kyneticai.com' or u.port not in (None,443):
        raise SystemExit('Refusing cross-origin redirect; no followed request made')
PY
body="$(mktemp)"
trap 'rm -f "$body"' EXIT
curl -q -s --show-error -L --proto '=https' --proto-redir '=https' --max-redirs 5 --max-time 60 \
  -o "$body" -w 'FOLLOW %{http_code} FINAL_URL %{url_effective}\n' "$url"
python3 - "$body" <<'PY'
import sys
from html.parser import HTMLParser
class Summary(HTMLParser):
    def __init__(self):
        super().__init__(); self.tag=None; self.title=[]; self.headings=[]
    def handle_starttag(self, tag, attrs):
        if tag in ('title','h1'): self.tag=tag
    def handle_endtag(self, tag):
        if tag==self.tag: self.tag=None
    def handle_data(self, text):
        if self.tag=='title': self.title.append(text)
        elif self.tag=='h1': self.headings.append(text)
p=Summary()
with open(sys.argv[1],encoding='utf-8',errors='replace') as f: p.feed(f.read())
print('TITLE', ' '.join(''.join(p.title).split())[:200] or '(no title)')
print('ADMIN_ALL_CLIENTS_HEADING', ' '.join(p.headings).strip()=='All clients')
PY
