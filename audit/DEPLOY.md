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


`modal deploy audit/app.py` prints one web URL for the `web` ASGI function. Use that URL as `$AUDIT_URL`. Routes are `GET /health`, `POST /audit`, and `GET /pdf/{run_id}.pdf`. Successful audit responses include a signed `pdf_url` (1-hour expiry). Download it from `$AUDIT_URL$pdf_url` without sending the audit key.

Smoke tests from the deployment machine:

```bash
curl -fsS "$AUDIT_URL/health"
curl -i -H 'X-Audit-Key: bad' -X POST "$AUDIT_URL/audit" -d '{}'
curl -fsS -H "X-Audit-Key: $AUDIT_SERVICE_API_KEY" -H 'Content-Type: application/json' -X POST "$AUDIT_URL/audit" --data @audit/tests/fixtures/free-request.json
```

Also verify one full request, a fake business returns `couldnt_check`, repeated `idempotency_key` returns the same `run_id`, and a request after the daily/monthly cap returns `429`. Do not call n8n, send email, or activate a workflow during smoke testing.

