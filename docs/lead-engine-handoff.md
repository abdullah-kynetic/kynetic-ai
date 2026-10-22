# Lead engine handoff (state as of 2026-10-20)

Single entry point for anyone (human or Claude session) taking over the lead-sourcing work for Plan 1. Everything below is backed by files in this repo on branch `claude/modest-thompson-h9atoy`; Twenty has a mirror note "LEAD ENGINE: Run B + pilots handoff (Oct 19-20, 2026)". Twenty is canonical; on a mismatch, flag it.

## 1. Goal and hard rules
- Goal: a repeatable, cheap way to get independent local businesses that are running Meta (Facebook/Instagram) ads, with the owner's name (sourced) and the best published phone. Plan 1 (outbound AI speed-to-lead agent, $4,675 for the first 3 clients, $8,500 after) is sold to them. Dialing target is 75 owner calls a day; the launch gate needs about 3,000 owner-gated numbers (task 7.1).
- A human cold-calls the owners. No AI calls to prospects (D-007).
- Public sources only. No logins, no CAPTCHA solving, no contacting any business, no form submissions or test leads.
- No people-search or data-broker sites (Lane A rule; the reason is not recorded, see KI-011). Do not record home addresses or consumer-only phone numbers.
- Never guess an owner or phone. Every non-unknown cell needs a source URL; owner names need a verbatim quote.
- Do not change Twenty, n8n or Retell without a yes on that specific change (CLAUDE.md).
- Open compliance question: using Treg's phone finder (personal mobile numbers) for cold calls is not cleared. TCPA/DNC counsel task 1.4 is still open. Treat the phone finder as off until counsel answers.
- Commits: author `abdullah-kynetic <abdullah@kyneticai.com>`, at most one trailer `Co-authored-by: Claude <noreply@anthropic.com>`.

## 2. What was tested, in order
| # | Date | Test | Files |
|---|---|---|---|
| 1 | Oct 19 | Researched sources for owner name and phone (Meta Ad Library, Maps, BBB, Texas Comptroller, county DBA, city permit portals, directories). Firecrawl unblocked after the environment's allowed domains were fixed. | `docs/progress.md` log 2026-10-19; `docs/known-issues.md` gotcha |
| 2 | Oct 19 | Run B: one prompt, run in Claude+Firecrawl and in Muse, Arlington TX roofing, then audited | `docs/lead-engine-run-b-prompt.md`, `lead-engine-run-b-claude-results.md`, `lead-engine-run-b-muse/`, `lead-engine-run-b-audit.md` |
| 3 | Oct 20 | Apify actor for the ad census (DFW roofing), then Muse enrichment of the top 10 | `docs/lead-engine-pilot-apify.md`, `lead-engine-run-b-muse/pilot-batch-results.csv` |
| 4 | Oct 20 | Treg paid enrichment on 3 owners (email find, verify, phone find) | this file section 4; costs below |
| 5 | Oct 20 | Code-only rerun with Firecrawl (no browser agent) on the same 10 | `tools/lead_enrich.py`, `docs/lead-engine-code-run/` |

## 3. Results
### Test 2: Run B, Arlington roofing (Claude+Firecrawl vs Muse)
- Both runs found the same two dial-ready businesses, owners and phones (Joe Hall Roofing, Rainstone Roofing). That agreement is the strongest quality signal. Claude also found a third (Trustmark Exteriors, MEDIUM). No fabricated cells in either.
- Muse got registry data (Comptroller officers, Arlington permit portal) that Firecrawl cannot reach because those are forms. Firecrawl was cheaper (about 62 credits), left direct ad links, and found Trustmark.
- Muse's "no active Meta ads found" DROPs for 14 Maps roofers are unreliable (exact-name search undercounts). Verify ads by Facebook Page URL or domain, never by exact-name keyword search.
- Yield was low: 2 dial-ready businesses for one city after about 60 minutes of agent work. Neither is a clear fit (Joe Hall is a 37-year firm with an office manager; Rainstone is about a year old).
- Full scorecard: `docs/lead-engine-run-b-audit.md`.

### Test 3: Apify census, DFW roofing
- Actor `solidcode/meta-ads-library-scraper` (id jrcXYlbOAUukohvxa), run `fisjWFkp9W2G0Dvpf`. Input: searchTerms ["roofing Dallas Fort Worth","roof replacement Fort Worth","roofing North Texas","roof replacement Arlington Texas","free roof inspection DFW"], country US, adActiveStatus ACTIVE, maxResults 1000, scrapeAdDetails true, includeAboutPage true; hard cap `?maxTotalChargeUsd=2`.
- Cost $0.31 for 343 ads (about $0.91 per 1,000 ads with both add-ons). Funnel: 343 ads, 93 unique advertisers (by Page ID), 48 with a Texas signal, 33 with 2+ active ads, about 27 real roofers.
- Answer-key test: found Joe Hall (11 ads), Rainstone (14), Proclaim; missed Trustmark, Frame Restoration, JML (keyword search is text-based, not geographic).
- Many top advertisers use Facebook instant forms (no website in the ad). That is the ideal prospect type, but their site and phone need a Maps lookup.
- Apify account: user `kyneticai`, FREE plan, $5 monthly cap (the "$30" Abdullah expected is not visible on this token).
- Muse batch (10 businesses) audited against Texas open data and Firecrawl checks. Final statuses: DIAL_READY Bert Roofing (confirm phone), Top Sun Roofing, Heirloom (Sherman, outside the DFW core), Verified Roofing; HOLD Johnny Walker (already runs an AI receptionist "Grace"), Berry Good (right-to-transact N), Pursuit (owner unconfirmed); DROP Ruff (Houston HQ), DFW Roofing Inspections, MB Roofing. Muse's headline said 7 DIAL_READY but the CSV had 6.

### Test 4: Treg
- API: base `https://treg.to`, header `X-Treg-Token`; `GET /catalog/search?q=`; `GET /catalog/endpoints/<id>/access` (estimated cost); `POST /call/<id>`; cost-cap header `X-Treg-Route-Max-Cost`, `X-Treg-Route-Verify`, `Idempotency-Key`; actual cost in response header `x-treg-cost-micro` (millionths of a dollar). Misses on per-success providers are free. The default per-call cap is $1, so always set a low cap. No REST balance endpoint is documented.
- Keys in the cloud environment: `TREG_API_KEY_KYNETICAI` (Abdullah says this holds the $1) and `TREG_API_KEY_BLITZ`. Never print or commit key values.
- Spend: about $0.049 of the $1. Hunter domain search on Pursuit $0 (0 results); email finds $0.0048 + $0.0048 (Quickenrich) + $0.0089 (Tomba); email verifies $0.0015 x 2; phone finds $0.0005 x 2 plus line verification $0.0132 x 2; one phone miss $0. Phones: $0.0274 of which $0.0264 is line verification.
- Verdict: worked well on 3 people, but the sample is too small. A "live" line check does not prove the number reaches the owner. Treg enriches only; it does not find businesses. The phone finder mostly needs a LinkedIn URL. A miss happened for Joshua Sutton's phone when given only email and domain. Recommended next: 10-15 owners with LinkedIn URLs, then hand-dial 5 to measure reach, under a $0.50 cap. Do not store phone numbers it returned until the compliance question is answered.

### Test 5: Firecrawl-only script
- `tools/lead_enrich.py` (stdlib Python; reads `FIRECRAWL_API_KEY`). Pipeline per business: Texas open data (data.texas.gov dataset 9cir-efmm via Firecrawl) -> Comptroller account page by taxpayer number -> Firecrawl search for the BBB profile -> BBB profile scrape (Business Management) -> business site and About page. No LLM; regex only; never guesses.
- Cost and time: 53 credits for the final run (about 5 per business), 4 minutes wall clock because calls are paced against HTTP 429. The first run (48 credits) was discarded.
- Quality: owner names matched Muse on all 7 businesses where Muse found one; no owner for Pursuit, DFW Roofing Inspections, MB Roofing (same as Muse). Phones matched on Heirloom, Verified, Berry Good, Top Sun; Bert and Pursuit returned several (flagged); Johnny Walker differs from Muse; Ruff got a number Muse lacked.
- Limits: cannot judge geography (Ruff is Houston), AI-receptionist claims, or which phone reaches the owner; the registry name search is ambiguous for common words (lists candidates, does not pick). A first version matched wrong BBB profiles (DFW Roofing Inspections, MB Roofing, Pursuit); fixed by requiring the first two distinctive name words in the BBB URL.

## 4. Strategy conclusions so far
- Cheapest working stack: Apify for the ad census (cents per 100 advertisers) -> free code filter (dedupe by Page ID, 2+ active ads, Texas signal, drop franchises/lead-gen/FL/OK) -> Firecrawl script for BBB, registry and site -> human or Muse only for HOLD rows and form-gated sources (Arlington permit portal, Google reply names) -> Treg only for gaps, with a cost cap -> Claude audit.
- Muse is thorough but slow (clicks every link). Firecrawl is fast and cheap but cannot fill forms.
- Phone certainty is the unsolved problem. Every tested stack surfaces several numbers; none shows which one reaches the owner. Hand-dial a sample to measure.

## 5. Open items
- Not yet built: geography/franchise filter in code, AI-receptionist detector, phone-conflict resolver, Maps lookup for instant-form advertisers.
- Proposed architecture (not built): n8n trigger -> webhook to a Modal Python job (Apify -> filter -> Firecrawl script -> optional Treg) -> callback to n8n -> write DIAL_READY/HOLD/DROP rows and run cost to Twenty. Use an async spawn plus callback (a Modal sync endpoint times out around 150 s), Modal Secrets for keys, a per-run budget guard, and a header-auth secret on both webhooks (KI-005). No Twenty/n8n/Modal change is approved yet.
- Run the remaining ~17 roofers from the Apify list; scale the Treg test; decide on Treg phone-finding with counsel (task 1.4).
- Pending decisions from KI-011: where the original research CSVs (`research/search-queries.csv`, `wave*-raw.csv`) live, Treg token rotation (token pasted in chat Oct 10), and the D-002 reword (Twenty Oct 13 notes say front-desk businesses are not dropped).
- Ruling: Pursuit may match registry "PURSUIT ROOFING LLC" (Southlake, right-to-transact N); unconfirmed.

## 6. Where everything is
- Repo: `abdullah-kynetic/kynetic-ai`, branch `claude/modest-thompson-h9atoy` (docs listed above, `tools/lead_enrich.py`).
- Twenty (crm.kyneticai.com): notes "Lead Engine: research, ICP and method (Lane A)", "Search List + How Searches Ran", "MUSE PROMPT: Wave 1 North DFW census", "Qualifying Checks + Oct 13 Scraping (Superseded Demo)", "Kynetic Prospecting Plan", and the new handoff note; tasks 2.1, 2.2, 2.4, 2.5, 7.1.
- Scratch outputs from the Apify and Treg runs lived in the old cloud session only and are not in the repo.

## 7. Prompt to start the new project
```
You are taking over the lead-sourcing work for Kynetic AI's Plan 1 (outbound AI speed-to-lead agent). Repo: abdullah-kynetic/kynetic-ai, branch claude/modest-thompson-h9atoy. Twenty CRM (crm.kyneticai.com) is the system of record.

Before doing anything, read in this order: CLAUDE.md, docs/progress.md, docs/decisions.md, docs/known-issues.md, KYNETIC_CONTEXT.md, then docs/lead-engine-handoff.md (full state, results, and rules). Then skim docs/lead-engine-run-b-audit.md, docs/lead-engine-pilot-apify.md, tools/lead_enrich.py and docs/lead-engine-code-run/results.csv.

Goal: a repeatable, low-cost pipeline that finds independent local businesses running Meta ads and returns the owner's name and best published phone, for a human to cold-call. Current best stack: Apify actor solidcode/meta-ads-library-scraper for the census, a free code filter, tools/lead_enrich.py (Firecrawl) for BBB/registry/site, Treg only for gaps under a cost cap, Muse or a person only for HOLD rows.

Hard rules: a human makes the calls; public sources only; no logins, CAPTCHAs, form submissions or contacting businesses; no people-search or data-broker sites; never guess an owner or phone (unknown beats a guess, and every claim needs a source URL); do not change Twenty, n8n, Retell or Modal without my yes on that specific change; do not use Treg's phone finder until counsel (task 1.4) clears it; keep Treg spend under $0.50 per test; never print or commit keys. Commits are authored abdullah-kynetic <abdullah@kyneticai.com> with at most the trailer Co-authored-by: Claude <noreply@anthropic.com>.

Next steps, in order: (1) add to tools/lead_enrich.py a geography/franchise filter, an AI-receptionist/chat-widget detector and a phone-conflict report; (2) run the remaining ~17 roofers from the Apify list and score the output against the audited statuses in docs/lead-engine-pilot-apify.md; (3) once it holds up, propose (do not build) the Modal + n8n + Twenty architecture in section 5 of the handoff and wait for my yes; (4) end the session with the build-log skill. Report cost (Apify dollars, Firecrawl credits, Treg dollars), time and hit rates every run.
```
