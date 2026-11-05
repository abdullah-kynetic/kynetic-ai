# Email domain and DNS inventory

Documentation only. No DNS record was queried, created, edited or deleted during
this step, and no email was sent. Values marked pending are NOT verified records.
Publishing DNS, live email testing and production configuration each require
Abdullah's explicit approval. Do not copy examples into the live zone by assumption.

## Known configuration and source

[Architecture: Domain, DNS and email domain](../ARCHITECTURE.md) specifies Resend
and the sending subdomain `mail.kyneticai.com`. Current server configuration uses
`EMAIL_FROM_ADDRESS`, default `notifications@mail.kyneticai.com`; display names may
vary by tenant, while platform auth uses Kynetic AI. `RESEND_API_KEY` and
`RESEND_WEBHOOK_SECRET` are runtime secrets, never DNS TXT values or documentation.
DEV providers are stubbed, so the final DEV deployment does not require email DNS.

## Record inventory to reconcile before any approved change

| Purpose | DNS type | Owner/name | Required value and current evidence |
| --- | --- | --- | --- |
| SPF authorization | TXT | Exact envelope/return-path host supplied by Resend for the sending domain | Provider-issued SPF include/value pending; not read or verified in this run. Do not add a second SPF record or assume an apex value. |
| DKIM signing | TXT or CNAME, as provider specifies | Provider selector under `_domainkey.mail.kyneticai.com` | Selector and public key/target pending from the exact domain's Resend dashboard. No invented key or selector. |
| DMARC alignment/reporting | TXT | `_dmarc.mail.kyneticai.com` (confirm inherited policy and owner first) | Architecture proposes starting `p=none` and tightening after a clean month. Exact policy/reporting address and current published value remain unverified; no new alert/report recipient selected. |
| Return-path delivery | MX, if required by the provider | Exact provider-assigned envelope host | Priority and target pending from Resend. Do not change the business's existing inbound MX records. |
| DEV web TLS | A/AAAA and HTTPS service, not email authentication | `dev.kyneticai.com` | Prior Mac deployment evidence reports HTTPS working. No DNS change is part of the final deployment script. |

An SPF/DKIM/DMARC record is public authentication metadata, not a secret store.
Do not put API keys, service tokens, private DKIM keys or webhook signing secrets
in any record. Copy only provider-designated public values after approval.

## Verification evidence required later

1. Confirm the exact Resend account/domain and current DNS owner. Record the zone,
   timestamp, provider verification status and existing RRsets in a safe inventory.
2. Compare exact proposed RRset changes and expected effect; obtain approval before
   applying. Preserve unrelated MX/TXT/site records and existing authentication.
3. After an approved change, check authoritative answers, propagation and provider
   verification. Record actual values/status; do not mark this inventory verified
   merely because the provider returned an HTTP 200.
4. Before a real email test, agree the recipient and obtain send approval. Inspect
   authentication/alignment results and signed delivery/bounce/complaint handling.
   Stub webhooks prove handler behavior only; they do not prove deliverability.
5. Stop on mismatch or failed verification. Never send a magic link, invite,
   notification or report to a real address just to complete a documentation check.

Current live domain verification, published SPF/DKIM/DMARC, mailbox deliverability
and DMARC monitoring are **UNVERIFIED**. These are future evidence gates, not cloud
build blockers or implied permission to modify DNS during the step-6 live test.
