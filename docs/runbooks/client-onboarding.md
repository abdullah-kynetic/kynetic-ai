# Onboarding a new client (live in one day)

Goal (phase check P4-6): from "they said yes" to the owner signed in, in under a day. The portal part takes minutes; most of the day is the provider setup and the owner's own steps. Nothing customer-facing is sent without an admin's approval, and nothing here places a call or text.

Before you start: a signed contract and the 20% booking baseline agreed (see `docs/STATUS.md`, the offer in force). Contacts for prospects stay phone-only and human-dialed (D-007); this runbook is for a client who already signed.

## 1. Create the client (about 2 minutes, `/admin/clients/new`)

One form, one transaction. Fill: business name, owner email, owner phone, industry template, time zone, hours, service zip codes, brand color, plan, modules. Leave the web address blank to derive it from the name.

It creates, together or not at all:

- the client account with the default pipeline (or the remodeling stages for the Remodeling template) and an Alex draft
- the owner invite, held back as a draft
- the module rows you ticked (the follow-up bundle turns on its three members)
- the business profile: hours, service area, services from the template, transfer number
- the setup checklist, with account, modules and profile already done

It refuses a duplicate owner email or web address and creates nothing in that case. Nothing is emailed.

## 2. Send the owner invite (approval, 1 minute)

On the created screen the invite email is shown as a draft. Read it, then **Approve and send**. If email delivery is not connected yet the button says so and sends nothing; use the same button later. The link works once and expires in 7 days. Approving again issues a fresh link and revokes the old one. Staff sign in with Google plus an authenticator; client owners use the emailed link and the email code.

## 3. Work the checklist (`/admin/clients/<id>/checklist`)

Internal steps (Twilio number, voice agent, n8n workflow, guarantee baseline) are hidden from the owner. Each step that touches a live system needs its own yes: a Twilio number, an ElevenLabs agent change, activating an n8n workflow. Build n8n workflows inactive. Do not touch Nora, Emily, the live Alex agent or the Demo records.

Order that fits one day: invite sent, calendar and booking rules, consent wording, contact import (the owner can self-serve import), test call and test text to your own number, guarantee baseline, go-live.

## 4. Go-live

Only when every step is done, consent wording is set, quiet hours are right (8am to 9pm plus state rules), and Abdullah says yes. `OUTBOUND_ENABLED` stays whatever it is; turning real sending on is a separate yes.

## If it went wrong

- Wrong owner email on a client you just created and have not invited: ask Abdullah; there is no edit-in-place for the owner email yet.
- Invite sent to the wrong address: the old link is revoked by sending a fresh one, but the old email stays in that inbox. Treat as an incident ([incident.md](incident.md)) if the wrong person could have used it before approval, and note the 7-day expiry.
- Client leaves: [offboarding.md](offboarding.md).

## Evidence

| What | Proof |
|---|---|
| The form creates everything in one step, rolls back on failure, and only sends on approval | `tests/integration/admin-onboarding.test.ts` |
| The same through the real pages, including duplicate refusal and the "email not connected" safe failure | `tests/e2e/phase-4-onboarding.spec.ts` |

Dated dry run, 2026-11-13: the end-to-end test above drove the real admin pages against a scratch database with stub providers: client created, invite held as a draft, approval refused safely with no mail provider, checklist present, duplicates refused. This was not run on the live portal (no live action was taken), so the "owner signed in within a day" half of P4-6 still needs one real onboarding with a yes.

| Date | Client | Created to owner signed in | Notes |
|---|---|---|---|
| (first real client) | | | |
