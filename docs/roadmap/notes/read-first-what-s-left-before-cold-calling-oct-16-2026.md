# [ARCHIVED 2026-11-09, superseded by ROADMAP 7bfdcb7e] READ FIRST — What's left before cold calling (Oct 16, 2026)

_Twenty note `ee73d407`, created 2026-10-17, updated 2026-11-09. Exported 2026-11-12._

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

Pulled from GitHub (docs/progress.md, docs/plan1-walkthrough.md, docs/known-issues.md) and all 49 open Twenty tasks on Oct 16, 2026. Phase 3 (3.5 outbound build and the voice provider bake-off) is being handled in a separate chat and is left out here.

**Where it stands:** dialing was planned for Oct 15 and is now set for **Tuesday Oct 20** (could move up to Monday Oct 19; updated Oct 17). Task 7.1 (launch gate) is TODO, and none of the gate items are marked DONE in Twenty. 33 [P1] tasks: 2 done.

**Launch gate (7.1):** demo works end to end; the lead list refills without Abdullah; proposal, Stripe and agreement can go out the same day; dry run time is known; scripts are final and practiced.

## In order: what to do before dialing

1. **Leads (nothing to dial without them).** 2.1 Meta Ad Library niche count and owner-gated list. 2.2 Owner pass on the 14 Dallas roofers (groups A and B). 2.4 Load owner-gated rows into Twenty as Companies, with the source of every fact. The pool needs about 3,000 owner-gated numbers for 75 dials a day. 2.3 (Muse test) and 2.5 (auto-refill loop) are needed for the gate's "refills on its own" item.
2. **Quentin decisions (were due Oct 14, now due Mon Oct 19).** Who dials and how the 75 a day is split. Confirm that "completion" means build go-live.
3. **Call scripts.** 4.1 "I just saw your ad" opener plus the revenue calculator (IN PROGRESS). 4.2 Demo call script, objection answers, voicemail script, Google Voice line. Practice them.
4. **Close kit (so a yes can be signed the same day).** 4.4 Guarantee terms. 4.5 One-page proposal ($4,675 first 3 / $8,500, 50/25/25). 4.6 Stripe milestone invoices. 4.7 Agreement rewrite, then 4.8 attorney review. 4.3 Unit economics (cost per client).
5. **Legal (blocks going live, not hand dialing).** 1.4 Counsel sign-off on the TCPA emergency opt-out gap (IN PROGRESS; email drafted, no reply yet; this has the longest lead time). 3.6 Compliance: SMS opt-out, Contact relation, webhook auth (KI-005), consent wording. 1.3 A2P 10DLC is for SMS only, so it doesn't block voice.
6. **Onboarding ready.** 3.7 [CLIENT] template plus the Add a Client guide. 5.1 Intake form and checklist. 5.2 Onboarding automation (agreement, Stripe, welcome, kickoff booking). 5.4 Day-of-close activation SOP. 5.3 Voice-first onboarding. The portal (below) already covers part of 5.1 and 5.2: client accounts, invites, documents and the timeline.
7. **Dry run, then the gate.** 6.1 Quentin plays a fake client and every step is timed. Then 7.1 is checked item by item. The dry run should include inviting the fake client to the portal.
8. **Can wait until after the first sign (open question from the walkthrough):** 5.6 to 5.8 (weekly summary, monthly report, referral ask), and the manual prospect follow-up drafts.

## Client portal (added Oct 16; was missing from this plan)

This is task 5.5, now IN PROGRESS. https://portal.kyneticai.com is built, deployed on the VPS and live (DNS, TLS, health check OK). Abdullah's admin login and MFA work. Only the fake Test Client A/B exist. Code is on branch `portal` (folder /portal), not merged.

Left to do, in order:
1. Resend: verify the domain and set RESEND_API_KEY. Without it, invite and login emails never reach clients. The free tier (100 a day) is plenty.
2. Cloudflare R2: create a bucket and keys and set the 4 R2_* vars (the free tier is 10 GB). Then add an off-box copy of the nightly backup to R2.
3. Create Quentin's admin account.
4. Create a Kynetic Roofing (Demo) client with demo results, so it can be shown on sales calls.
5. Once 3.5 runs: an ingest key plus a daily n8n push of real numbers (the n8n change needs approval).
6. Open a PR for the `portal` branch and merge it.

From the free-stack video: Resend and R2 fit and are already supported in the code. Cloudflare Workers, Neon and Clerk don't fit: the portal already runs on the VPS at no extra cost with its own Postgres (RLS) and Auth.js plus MFA, and switching would mean a rewrite for no gain. Don't host it on Vercel Hobby, which bans commercial use.

Not a blocker for dialing. Steps 1 to 4 are small and can run alongside items 1 to 3.

**Fastest route to the first dial:** items 1 to 3 plus the demo (Phase 3). Items 4 to 7 can be built during the first week of dialing, since a booked call takes days to turn into a close. That would change D-003 (build everything first), so it is Abdullah's call.

Note: Twenty task statuses have gone stale before (Oct 6 audit). If something above is already done, mark it DONE.
