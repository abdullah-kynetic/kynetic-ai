# Incident response

Written to the approach approved on 2026-10-25 (`docs/SECURITY.md`): contain with the kill switch and key revocation, assess affected clients from the audit log, notify affected clients within 72 hours, record it. Which states require what notice is still unresolved and needs counsel (`docs/counsel-questions.md`). Do not tell a client anything legal about notification duties without it.

An incident is any of: a login or data exposure you did not expect, a call or text that should not have gone out, a client seeing another client's data, a provider key that leaked, the portal down for clients, or backups failing for more than a day.

## 1. Contain (first 15 minutes)

Do the least that stops the harm. Each step below is reversible except where it says otherwise.

| Problem | Containment |
|---|---|
| Calls or texts going out wrongly | Admin outbound pause in `/admin/operations` (blocks every call and text). `OUTBOUND_ENABLED=false` in `runtime.env` stops everything and is the live value today; confirm it has not changed. A per-client kill switch exists on the client page. |
| One client's account or automations | Suspend the client from its admin page. Offboarding also suspends, but starts an export; use plain suspend if the client is staying. |
| A service token or webhook secret leaked | Revoke the token on the client's Service tokens panel. Rotate the provider-side secret only with Abdullah's yes. Note: the Treg token was already rotated; do not recommend rotating it again. |
| A staff account may be taken over | Admin > Users: Deactivate the user, or Reset authenticator. If no admin can sign in, `crm/scripts/emergency-reset-staff-totp.md`. |
| Wrong data shown across clients | Take the portal out of use with a rollback ([rollback.md](rollback.md)) if a recent deploy caused it; otherwise suspend the affected clients. Do not edit data to hide it. |
| Portal down | `portal-new-deploy status`, then the app and worker logs. A dead worker shows as `worker: stale` on `/api/health`. |

Do not delete anything, restore a database or rewrite history while containing. Preserve evidence.

## 2. Assess

1. Write the first timestamp (UTC and PT), who noticed, and what they saw.
2. Use the audit page (`/admin/audit`) to find who did what and when. Filter by client and by action.
3. List which clients are affected and what kind of data (contacts, call metadata, messages, documents). Recordings and transcripts are separate from the export zip.
4. Decide whether data left the system or was only visible to the wrong person inside it.

## 3. Fix and verify

Deploy a fix through [deploy.md](deploy.md) (needs a yes) or a rollback. Check with the same steps that showed the problem. Leave the containment in place until the check passes.

## 4. Notify

Affected clients within 72 hours of confirming exposure. Draft the message for Abdullah to approve; never send it from a session. Say what happened, which of their data, what was done, and what they should do. Counsel decides any legal notice.

## 5. Record

In the same week: dated entries in `docs/known-issues.md` (what, which clients, status) and `docs/progress.md`, and a decision in `docs/decisions.md` if the fix changes a rule. Keep secrets, personal data and message bodies out of those files.
