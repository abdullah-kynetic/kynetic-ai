# LEAD ENGINE: Run B + pilots handoff (Oct 19-20, 2026)

_Twenty note `3500a917`, created 2026-10-20, updated 2026-10-25. Exported 2026-11-12._

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

# Lead engine: Run B + pilots handoff (Oct 19-20, 2026)
Full detail, results and a start prompt for a new session: repo `abdullah-kynetic/kynetic-ai`, branch `claude/modest-thompson-h9atoy`, file `docs/lead-engine-handoff.md` (mirrors this note). Related: `docs/lead-engine-run-b-audit.md`, `docs/lead-engine-pilot-apify.md`, `tools/lead_enrich.py`, `docs/lead-engine-code-run/`.

## Rules
Human cold-calls owners (D-007). Public sources only; no logins, no form submits, no contacting businesses; no people-search/data-broker sites; never guess an owner or phone. No Twenty/n8n/Retell/Modal change without a yes on that specific change. Treg phone finder OFF until counsel clears TCPA/DNC (task 1.4).

## What was tested and the results
1. **Run B, Arlington TX roofing, Claude+Firecrawl vs Muse (Oct 19).** Both found the same 2 dial-ready businesses (Joe Hall Roofing, Rainstone) with the same owners and phones; Claude also found Trustmark (MEDIUM). No fabricated cells. Muse reached Comptroller officers and the Arlington permit portal (forms); Firecrawl was cheaper (about 62 credits) with direct ad links. Muse's 'no ads found' DROPs (14 Maps roofers) are unreliable; verify ads by Page URL/domain. Yield low: 2 dial-ready per city after about 60 min.
2. **Apify census, DFW roofing (Oct 20).** Actor solidcode/meta-ads-library-scraper: 343 active ads for $0.31 -> 93 advertisers -> about 27 real roofers. Missed Trustmark, Frame Restoration, JML (keyword search is text-based). Apify account is Free, $5 monthly cap (not $30). Muse enriched the top 10; audited: DIAL_READY Bert (confirm phone), Top Sun, Heirloom (Sherman), Verified; HOLD Johnny Walker (already has AI receptionist), Berry Good (right-to-transact N), Pursuit (owner unconfirmed); DROP Ruff (Houston HQ), DFW Roofing Inspections, MB Roofing.
3. **Treg test, 3 owners (Oct 20).** About $0.049 of $1 spent (email finds, verifies, phone find + line check). Works; sample too small; a live line check does not prove the owner answers; phone finder mostly needs a LinkedIn URL; one phone miss. Next: 10-15 owners then hand-dial 5, under $0.50.
4. **Firecrawl-only script (Oct 20).** tools/lead_enrich.py: Texas open data -> Comptroller page -> BBB -> site. Same 10 businesses: 53 credits, 4 min, owner names matched Muse 7 of 7, phone conflicts flagged not guessed. Cannot judge geography, AI receptionist, or which phone reaches the owner.

## Strategy so far
Apify census -> free code filter (dedupe Page ID, 2+ ads, Texas signal, drop franchises/lead-gen/FL/OK) -> Firecrawl script -> Muse/human only for HOLD and form-gated sources -> Treg only for gaps (capped) -> Claude audit. Unsolved: which phone reaches the owner.

## Proposed, NOT built or approved
n8n trigger -> Modal Python job (async spawn + callback) -> n8n writes DIAL_READY/HOLD/DROP + run cost to Twenty. Needs header-auth on both webhooks (KI-005).

## Mismatches to resolve (flagged, nothing changed)
- D-002 in the repo still says drop businesses with a receptionist/front desk; Oct 13 notes and the Lane A note say front-desk businesses are NOT dropped. The reword to 'no dedicated instant-response call center' is PENDING Abdullah's yes.
- research/search-queries.csv and the wave*-raw.csv / rerun-raw.csv / maps-adcheck.csv files from 'Search List + How Searches Ran' are not in the repo; location unknown.
- The Treg token pasted in chat on Oct 10 should be rotated; not confirmed. Which Treg key holds the $1: Abdullah says TREG_API_KEY_KYNETICAI.
- The 'no people-search/data-broker sites' rule has no recorded reason (counsel question for 1.4 if it should loosen).

## Next
(1) Add geography/franchise filter and AI-receptionist detector to tools/lead_enrich.py; (2) run the remaining ~17 roofers and score against the audited statuses; (3) scale Treg test; (4) propose the Modal/n8n/Twenty build for approval.
