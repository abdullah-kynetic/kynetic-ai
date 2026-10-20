# n8n → portal results ingest

n8n pushes one row per client per day to the portal. Each client has its own API key; the key alone decides which client the rows belong to.

**Endpoint:** `POST https://portal.kyneticai.com/api/ingest/results`
**Auth:** `Authorization: Bearer kp_<prefix>_<secret>` (generate under Admin → client → Ingest keys; shown once)

## Payload

```json
{
  "rows": [
    { "date": "2026-10-15", "leads": 8, "calls": 11, "bookings": 3, "minutes_used": 42.5, "avg_speed_to_lead_sec": 18.4 }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `date` | `YYYY-MM-DD` | required; one row per client per day |
| `leads`, `calls`, `bookings` | integer ≥ 0 | default 0 |
| `minutes_used` | number ≥ 0 | voice minutes that day |
| `avg_speed_to_lead_sec` | number ≥ 0 or null | average seconds from lead to first contact |

Unknown fields are **rejected** (400), including `client_id`. Max 400 rows and 256 KB per request. Rows upsert on (client, date), so re-sending a day overwrites it and retries are safe.

## Example

```bash
curl -sS -X POST https://portal.kyneticai.com/api/ingest/results \
  -H "Authorization: Bearer $PORTAL_INGEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"date":"2026-10-15","leads":8,"calls":11,"bookings":3,"minutes_used":42.5,"avg_speed_to_lead_sec":18.4}]}'
# → {"ok":true,"upserted":1}
```

## Optional body signature

Send `X-Kynetic-Signature: sha256=<hex>` where the hex is HMAC-SHA256 of the raw request body keyed with the full API key. If the header is present and wrong the request is rejected (401).

## Responses

| Status | Meaning |
|---|---|
| 200 | `{"ok":true,"upserted":N}` |
| 400 | invalid JSON/body (`issues` lists the first problems) |
| 401 | missing, wrong or revoked key, or bad signature |
| 413 | payload too large |
| 429 | rate limited (120 req/min per IP, 60 req/min per key) |

## n8n HTTP Request node

```json
{
  "method": "POST",
  "url": "https://portal.kyneticai.com/api/ingest/results",
  "sendHeaders": true,
  "headerParameters": { "parameters": [{ "name": "Authorization", "value": "=Bearer {{ $credentials.portalKey }}" }] },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify({ rows: $json.rows }) }}"
}
```

Store the key in an n8n credential (Header Auth) rather than in the workflow JSON.

## Rotating a key

1. Admin → client → Ingest keys → Generate key; copy it.
2. Update the n8n credential.
3. Run the workflow; confirm the new key's **Last used** updates.
4. Revoke the old key.
