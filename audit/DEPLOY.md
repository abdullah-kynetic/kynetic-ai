# Audit deployment handoff

Modal is the only deployment target. Do not deploy or modify any other Modal app.

```bash
python -m venv .venv-audit
.venv-audit/bin/pip install modal
export MODAL_TOKEN_ID='provided-by-environment'
export MODAL_TOKEN_SECRET='provided-by-environment'
export OPENROUTER_API_KEY='provided-by-environment'
export GOOGLE_PAGESPEED_API_KEY='provided-by-environment'
export AUDIT_SERVICE_API_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
.venv-audit/bin/modal secret create kynetic-audit-secrets \
  AUDIT_SERVICE_API_KEY="$AUDIT_SERVICE_API_KEY" \
  OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  GOOGLE_PAGESPEED_API_KEY="$GOOGLE_PAGESPEED_API_KEY"
.venv-audit/bin/modal deploy audit/app.py
```

The generated key exists only in the shell variable and Modal secret; do not print it or commit it. Copy it into n8n manually from the Modal dashboard when ready. The deploy command targets only the app declared as `kynetic-audit` in `audit/app.py`.

Optional environment controls must be set before the process starts; they are never accepted from an audit request:

```bash
export AUDIT_DAILY_CAP_OVERRIDE=2   # temporary cap test only
unset AUDIT_DAILY_CAP_OVERRIDE      # restore the default of 50
export AUDIT_OPERATOR_KEY='operator-only-value'  # keep outside public/n8n form traffic
```

`AUDIT_OPENROUTER_MODEL` may select a configured `:free` model. The service first queries OpenRouter's model catalog and filters zero-priced `:free` models, then falls back through the configured free-model order. No paid model is accepted.

Smoke tests from the deployment machine:

```bash
curl -fsS "$AUDIT_URL/health"
curl -i -H 'X-Audit-Key: bad' -X POST "$AUDIT_URL/audit" -d '{}'
curl -fsS -H "X-Audit-Key: $AUDIT_SERVICE_API_KEY" -H 'Content-Type: application/json' -X POST "$AUDIT_URL/audit" --data @audit/tests/fixtures/free-request.json
```

Also verify one full request, a fake business returns `couldnt_check`, repeated `idempotency_key` returns the same `run_id`, and a request after the daily/monthly cap returns `429`. Do not call n8n, send email, or activate a workflow during smoke testing.

The local test suite mocks PageSpeed, OpenRouter, Nominatim, Maps HTML, and Unlighthouse output. If Node/Chromium is unavailable locally, the Unlighthouse live run is reported as `couldnt_check`; the Modal image installs Python 3.11, Node/npm, Chromium/Playwright, and Unlighthouse.

## Provider probe

From the repository root, the deployer can run individual checks without printing response payloads or secrets:

```bash
python audit/scripts/live_probe.py https://www.kyneticai.com --check pagespeed
python audit/scripts/live_probe.py https://www.kyneticai.com --check ai_mentions
python audit/scripts/live_probe.py https://www.kyneticai.com --check maps --name "Business Name" --city Austin --state TX
python audit/scripts/live_probe.py https://www.kyneticai.com --check geogrid --name "Business Name" --city Austin --state TX
python audit/scripts/live_probe.py https://www.kyneticai.com --check unlighthouse --mode full
```

Each line contains only the check name, status, and non-secret reason. Provider keys are read from the environment by the check or Modal function.

