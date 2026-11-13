#!/usr/bin/env bash
# One command that runs what CI runs, then prints a pass/fail table.
#
#   bash scripts/verify.sh quick   typecheck, lint, format, unit tests
#   bash scripts/verify.sh full    quick + integration tests (Postgres 16) + deploy-script rehearsal + build  (default)
#   bash scripts/verify.sh e2e     full + Playwright browser tests
#
# Exit code 0 only when every step passed. A step that could not run (no Postgres, no browser) counts as
# NOT passed, so an unverified run can never read as ready. "Ready" here means automated checks only:
# a deploy, a server change, an n8n activation or a real call still needs Abdullah's explicit yes.
set -u
cd "$(dirname "$0")/.."

mode="${1:-full}"
case "$mode" in quick | full | e2e) ;; *)
  echo "usage: verify.sh [quick|full|e2e]" >&2
  exit 2
  ;;
esac

# Same values CI uses (.github/workflows/crm-ci.yml): shared machines are slower than the baseline
# machine for the p95 search benchmark. The product target (500 ms, DC-033) is unchanged.
export LOAD_P95_MS="${LOAD_P95_MS:-5000}"
export TEST_DATABASE_ADMIN_URL="${TEST_DATABASE_ADMIN_URL:-postgres://postgres:postgres@localhost:5432/postgres}"

names=()
results=()
secs=()
failed=0

postgres_ready() {
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -q -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}"
  else
    (echo >/dev/tcp/localhost/5432) >/dev/null 2>&1
  fi
}

run_step() {
  local name="$1"
  shift
  echo
  echo "=== $name"
  local start=$SECONDS
  if "$@"; then
    results+=("pass")
  else
    results+=("FAIL")
    failed=1
  fi
  names+=("$name")
  secs+=("$((SECONDS - start))")
}

blocked_step() {
  local name="$1" reason="$2"
  echo
  echo "=== $name"
  echo "BLOCKED: $reason"
  names+=("$name")
  results+=("BLOCKED")
  secs+=("0")
  failed=1
}

deploy_scripts() {
  local f
  for f in deploy/prod/*.sh deploy/prod/host/*.sh deploy/prod/monitor/*.sh deploy/prod/tests/*.sh deploy/portal-new/portal-new-deploy deploy/portal-new/portal-new-deploy-entry deploy/portal-new/monitor/portal-monitor; do
    bash -n "$f" || return 1
  done
  bash deploy/prod/tests/rehearse.sh
}

run_step "typecheck" bun run typecheck
run_step "lint" bun run lint
run_step "format" bun run format:check
run_step "unit tests" bun run test

if [ "$mode" != "quick" ]; then
  if postgres_ready; then
    run_step "integration tests" bun run test:integration
  else
    blocked_step "integration tests" "no Postgres 16 reachable (set TEST_DATABASE_ADMIN_URL or start it)"
  fi
  run_step "deploy scripts" deploy_scripts
  run_step "production build" bun run build
fi

if [ "$mode" = "e2e" ]; then
  if postgres_ready; then
    run_step "browser tests" bun run test:e2e
  else
    blocked_step "browser tests" "no Postgres 16 reachable"
  fi
fi

echo
echo "================ verify ($mode) ================"
printf '%-22s %-8s %s\n' "step" "result" "seconds"
for i in "${!names[@]}"; do
  printf '%-22s %-8s %s\n' "${names[$i]}" "${results[$i]}" "${secs[$i]}"
done
echo "-----------------------------------------------"
if [ "$failed" -eq 0 ]; then
  echo "AUTOMATED CHECKS PASSED ($mode). Not a deploy approval: live steps still need an explicit yes."
else
  echo "NOT READY: at least one step failed or could not run."
fi
exit "$failed"
