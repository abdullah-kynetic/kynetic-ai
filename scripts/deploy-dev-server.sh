#!/usr/bin/env bash
# Invoked by deploy-dev.sh on the VPS as root. Never use against a production project.
set -euo pipefail
umask 077
[ "$(id -u)" = 0 ] || { echo 'Root is required for the dev directory and Caddy reload.' >&2; exit 1; }
upload="${1:?missing upload directory}"
revision="${2:?missing revision}"
verify_step3="${3:-}"
[ -z "$verify_step3" ] || [ "$verify_step3" = --verify-step3 ] || exit 1
[[ "$upload" =~ ^/tmp/kynetic-dev-upload\.[a-zA-Z0-9]+$ ]] && [[ "$revision" =~ ^[0-9a-f]{40}$ ]] || exit 1
root=/opt/kynetic-dev-portal
state=/var/lib/kynetic-dev-portal
caddy_config=/etc/caddy/Caddyfile
command -v docker >/dev/null
command -v caddy >/dev/null
command -v python3 >/dev/null
command -v curl >/dev/null
command -v flock >/dev/null
docker compose version >/dev/null
systemctl is-active --quiet caddy || { echo 'Expected host Caddy service; no changes made.' >&2; exit 1; }
[ -f "$caddy_config" ] && [ ! -L "$caddy_config" ] || { echo 'Expected regular /etc/caddy/Caddyfile; no changes made.' >&2; exit 1; }
install -d -m 700 "$root" "$state"
exec 9>"$state/deploy.lock"
flock -n 9 || { echo 'Another dev deployment is running.' >&2; exit 1; }
release="$root/releases/$revision"
install -d -m 700 "$release"
# Repeated runs of the same immutable revision use the same payload.
if [ ! -f "$release/.ready" ]; then
  install -d -m 700 "$release/crm"
  cp -a "$upload/crm/." "$release/crm/"
  touch "$release/.ready"
fi
[ -d "$release/crm" ] || exit 1
# Persistent random secrets belong only to this dedicated database cluster.
if [ ! -e "$state/dev.env" ]; then
  python3 - "$state/dev.env" <<'PY'
import os,secrets,sys
names=['PG_SUPER_PW','OWNER_PW','APP_PW','WORKER_PW','AUTH_PW','BACKUP_PW','BETTER_AUTH_SECRET','APP_ENCRYPTION_KEY','BACKUP_ENCRYPTION_KEY']
fd=os.open(sys.argv[1],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:
    f.write('APP_BASE_URL=https://dev.kyneticai.com\n')
    for name in names: f.write(name+'='+secrets.token_hex(32)+'\n')
PY
fi
chmod 600 "$state/dev.env"
compose() { docker compose --project-name kynetic-dev-portal --env-file "$state/dev.env" -f "$release/crm/deploy/dev/compose.yml" "$@"; }
# Reject collisions rather than disturbing a pre-existing listener or unrelated project.
if ss -ltnH 'sport = :3031' | read -r _; then
  [ -n "$(compose ps -q app)" ] || { echo 'Port 3031 is occupied by another service; no changes made.' >&2; exit 1; }
fi
# Build a candidate Caddy config by appending exactly one new site. Existing text is retained.
source_hash="$(sha256sum "$caddy_config" | cut -d ' ' -f 1)"
candidate="$(mktemp /etc/caddy/.kynetic-dev-candidate.XXXXXXXX)"
trap 'rm -f "$candidate"' EXIT
python3 - "$caddy_config" "$candidate" <<'PY'
import pathlib,re,sys
src=pathlib.Path(sys.argv[1]).read_text()
marker='# BEGIN KYNETIC DEV PORTAL (managed by deploy-dev.sh)'
block='''# BEGIN KYNETIC DEV PORTAL (managed by deploy-dev.sh)
dev.kyneticai.com {
    reverse_proxy 127.0.0.1:3031
}
# END KYNETIC DEV PORTAL
'''
if marker in src:
    if src.count(block)!=1: raise SystemExit('Managed dev site was edited; refusing to overwrite it.')
    candidate=src
else:
    # Scan imported files too. Avoid duplicate routes hidden in a sites-enabled import.
    if re.search(r'(?<![\w.-])dev\.kyneticai\.com(?![\w.-])',src):
        raise SystemExit('An unmanaged dev site already exists; refusing to overwrite it.')
    for path in pathlib.Path('/etc/caddy').rglob('*'):
        if path.is_file() and not path.is_symlink() and path != pathlib.Path(sys.argv[1]):
            if path.suffix in ('.pem','.key','.crt'): continue
            try: text=path.read_text()
            except (UnicodeError,OSError): continue
            if re.search(r'(?<![\w.-])dev\.kyneticai\.com(?![\w.-])',text):
                raise SystemExit('A dev site exists in another Caddy file; refusing duplicate route.')
    candidate=src+('' if src.endswith('\n') else '\n')+'\n'+block
pathlib.Path(sys.argv[2]).write_text(candidate)
PY
# Redirect operational logs to root-only files: errors may contain generated credentials.
log="$state/deploy-$revision.log"
fail() { echo "Deployment failed; private diagnostic log: $log (do not paste secrets)." >&2; }
trap fail ERR
run_private() {
  "$@" 2>&1 | python3 "$release/crm/deploy/dev/redact-log.py" "$state/dev.env" "$log"
}
run_private caddy validate --config "$candidate" --adapter caddyfile
run_private compose build app prepare
run_private compose up -d --wait --wait-timeout 120 postgres
# prepare runs bootstrap/migrations and synthetic-only validation before app start.
run_private compose run --rm prepare
run_private compose up -d --no-deps --wait --wait-timeout 180 app
[ "$(curl -q -sS -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3031/api/health)" = 200 ]
# The old open-mode image lacks /sign-in. Require the new auth behavior before recording success.
[ "$(curl -q -sS -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3031/sign-in)" = 200 ]
[ "$(curl -q -sS -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3031/admin)" = 401 ]
# Refuse concurrent edits rather than restoring an obsolete production config.
[ "$(sha256sum "$caddy_config" | cut -d ' ' -f 1)" = "$source_hash" ] || {
  echo 'Caddy config changed during the build; refusing to replace it.' >&2; exit 1;
}
if ! cmp -s "$candidate" "$caddy_config"; then
  backup="$state/Caddyfile.before-$revision"
  cp -p "$caddy_config" "$backup"
  install -m 644 "$candidate" "$caddy_config"
  if ! run_private systemctl reload caddy; then
    install -m 644 "$backup" "$caddy_config"
    run_private systemctl reload caddy || true
    echo 'Caddy reload failed; original config restored.' >&2
    exit 1
  fi
fi
if [ "$verify_step3" = --verify-step3 ]; then
  run_private compose --profile verify build verify-step3
  run_private compose --profile verify run --rm --no-deps verify-step3
  echo 'PASS DEV_STEP3_GATES consent blocked; quiet hours deferred; global/tenant kill switches blocked; fixtures rolled back; provider requests 0'
fi
ln -sfn "$release" "$root/current"
printf '%s\n' "$revision" > "$state/deployed-revision"
echo 'PASS dev database: isolated kynetic-dev-portal Postgres volume; synthetic seed guard passed'
echo 'PASS dev app: 127.0.0.1:3031/api/health HTTP 200; providers stubbed; outbound disabled'
echo 'PASS dev auth locally: /sign-in HTTP 200; anonymous /admin HTTP 401'
echo 'PASS dev HTTPS site installed: dev.kyneticai.com -> 127.0.0.1:3031'
echo 'Existing Caddy site blocks retained; production containers and database not changed.'
