# Billing: Stripe milestone invoices (D-017) (SUPERSEDED by D-023)

_Twenty note `3a39731e`, created 2026-09-24, updated 2026-10-25. Exported 2026-11-12._

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

# Billing: Stripe milestone invoices (D-017)

**PRICING (D-017, FINAL, Quentin signed off Oct 13, 2026):** Plan 1 is sold as a 3-month package at 15% off list: **$4,675** for the first 3 clients, **$8,500** for clients 4 and on. Billed as three Stripe invoices per client: 50% at start, 25% when built and sent for testing, 25% at completion. No subscription. Any older price in this note ($1,500 + $997/mo, $750 setup, $2,500/mo, $3,000 or $4,500 setup) is superseded.

---

**Processor:** Stripe. Three one-off invoices per client, no subscription, no setup + retainer.

| Tier | Invoice 1 (50%, at signing) | Invoice 2 (25%, built and sent for testing) | Invoice 3 (25%, completion) | Total |
|---|---|---|---|---|
| Clients 1–3 | $2,337.50 | $1,168.75 | $1,168.75 | $4,675 |
| Clients 4+ | $4,250 | $2,125 | $2,125 | $8,500 |

**Setup checklist (task 4.6):** Stripe account live (not test mode); invoice templates for each milestone; test end to end; record each invoice and payment in Twenty.

**Not confirmed:** what "completion" means (build go-live is assumed); late-payment terms; card vs ACH default; Stripe account readiness.

Keys live in environment variables only, never in notes or the repo. (The old "Kynetic OS CRM billing code" and Vercel references are dead; SeldonFrame/Kynetic OS was dropped Sep 24.)

---

## Legacy text (superseded, kept for reference)

**UPDATE Oct 1, 2026:** Stripe products to create now: "Setup Fee" **$1,500** one time and "Monthly Retainer" **$997/mo** recurring (founding price, speed to lead offer). The $3,000, $4,500 and $2,500 figures below are old. Subscription with the setup fee on the first invoice is the plan. No Stripe links are live yet. Original text is kept unchanged below. See MASTER PLAN and SESSION WRAP.

---

**Processor decision: Stripe**, already wired into the Kynetic OS CRM billing code, no separate processor needed. Used for both the one-time setup fee and the recurring retainer.

**Setup checklist:** confirm Stripe account is live (not test mode), create Product "Setup Fee" ($3,000 intro / $4,500 standard one-time), create Product "Monthly Retainer" ($2,500/mo recurring), generate a Payment Link for each, test both end-to-end with a real card in test mode, confirm webhook handling marks the client Active once payment clears.

**Payment terms:** setup fee due upon receipt before build begins. Retainer auto-charged monthly via Stripe subscription, card/ACH on file. Late payment: if a retainer charge fails and isn't resolved within 10 days, services pause. Accepted: card or ACH (ACH offered as default for the recurring charge since its fees don't scale with amount).

**Open item as of last update:** no client has been billed yet, first live Stripe test should happen with Client #1's setup fee. Live secret keys belong in Vercel env vars only, never in this doc.

---

## Merged from: Invoice Template (original note 1a40b94b, archived Oct 13, 2026)

**UPDATE Oct 1, 2026:** use these amounts: Setup Invoice **$1,500.00**, Monthly Invoice **$997.00** (founding price, speed to lead offer). The $3,000.00 and $2,500.00 figures below are old. Original text is kept unchanged below. See MASTER PLAN and SESSION WRAP.

---

Reference layout for invoices generated via Stripe.

**Setup Invoice (sent once, at signing):** Kynetic Revenue Recovery System - Setup & Onboarding, $3,000.00 total due.

**Monthly Retainer Invoice (recurring via Stripe subscription):** Kynetic Revenue Recovery System - Monthly Retainer, $2,500.00 total due.

**Payment terms:** setup invoice due upon receipt before build begins. Retainer invoice due on the 1st of each service month, auto-charged via Stripe subscription on file. Accepted: card or ACH via Stripe payment link. Late fee applies after 10 days past due.
