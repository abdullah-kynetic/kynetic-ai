# Kynetic — Lead Scrape

Sources leads from Google Maps into Notion for Kynetic AI's Phase 1 outreach, across 8 service niches (water damage restoration, roofing, foundation repair, tree service, pool contractors, septic, land clearing, commercial painting).

## Architecture

```
n8n (trigger + status only)
  └─ Scrape Form → Extract Fields → Create "Scrape Queries" row (Running)
        → POST to Modal → Check Success → Mark Complete/Failed + append result/error block

Modal — kynetic_agency_os_api.py (all real work happens here)
  └─ Apify (Google Maps scrape)
        → dedup against Notion "Scrape Log" DB (phone match, or name+city match)
        → classify each new lead: Franchise / Independent
             (hardcoded FRANCHISE_BRANDS list first — free — then OpenRouter
              gpt-4o-mini fallback for anything not obviously a known chain)
        → write confirmed leads to Notion "Outreach" DB (Lead Type + Classification Notes)
        → log only CONFIRMED writes back to "Scrape Log" (keeps the dedup index accurate)
        → return real stats to n8n
```

n8n only handles the trigger and the Scrape Queries status row — it never touches individual leads. All scraping, dedup, classification, and Notion writes happen inside the single Modal endpoint `scrape_leads`.

## Notion databases

| DB | Purpose |
|---|---|
| **📋 Scrape Queries** | One row per scrape run — niche, location, max places, and result counts (Leads Added / Skipped / Failed / Total Found). |
| **🗂️ Scrape Log** | Minimal dedup index (Business Name, City, Phone) — checked before every scrape so the same business is never re-added. |
| **📥 Outreach** | The real lead pipeline. Every confirmed lead lands here — franchises and independents alike — tagged via `Lead Type` (Franchise / Independent) with `Classification Notes` explaining why. Two saved views split it by type: **Independent** and **Franchise / Chains**. |

## Deploy

```bash
modal deploy kynetic_agency_os_api.py
```

Requires four Modal secrets already configured in the workspace: `api-auth-token`, `apify-secrets`, `notion-secrets`, `openrouter-api-key`. No secrets are hardcoded in the script.

## Fix log (Aug 20, 2026 audit)

An audit of the live v13 deploy found several silent-failure risks. Fixed in this version:

- **Silent lead loss** — `_log_to_scrape_log` used to run for every dedup-survivor regardless of whether the Outreach write actually succeeded. A business could get marked "seen" in Scrape Log while never actually landing in Outreach, permanently hiding it from all future scrapes. Now Scrape Log is only written for leads confirmed created in Outreach.
- **Wrong "Leads Added" count** — the returned `leads_added` used to be the dedup-survivor count, not the confirmed-write count, so it could overstate what was actually in Outreach whenever a write failed. Now it reflects confirmed writes only, with a new `leads_failed` field surfaced into the Scrape Queries `Notes` property when nonzero.
- **No rate limiting on Outreach writes** — the dedup and Scrape Log loops already throttled at 0.35s/call to stay under Notion's rate limit; the Outreach-write loop didn't. Added the same throttle plus one retry-on-429.
- **Timeout headroom** — bumped Modal's function timeout 300s → 420s to cover the added throttle/retry latency, since Apify's own request already eats up to 240s of the budget.
- **Blank `State` field / fragile city parsing** — the old address parser used a fixed `addr_parts[-2]` index that broke depending on whether Apify's address string included a trailing country segment. Replaced with a proper parser that also extracts `state`, which had no fallback at all before.
- **n8n failure path was likely unreachable** — `Call Modal Scrape API` had no `onError` override, so a non-2xx response from Modal (bad input, auth failure, Apify error) would halt the whole n8n execution before ever reaching the existing "Mark Scrape Query Failed" branch, leaving that Scrape Queries row stuck on "Running" forever. Set `onError: continueRegularOutput` so failures now actually route through the branch that was already built for them.
- **Stale duplicate script** — an older copy of this file (Supabase-based dedup, no franchise classification at all) existed in a different local folder and was almost certainly what got deployed by accident on Aug 14 (that run added obvious national chains like SERVPRO and PuroClean with zero filtering). Not included in this repo.

Known remaining gap, not yet fixed: the hardcoded `FRANCHISE_BRANDS` list only covers restoration-industry chains. For the other 7 niches, every lead falls through to the paid OpenRouter classification call — correct, just not free.

## Niche mapping (Aug 21, 2026)

The finalized ICP niche list (see Agency Overview / ICP — Problem-to-Business Fit in Notion) names the flagship niche **"Water/Fire/Storm Restoration"** with two real Google Maps search terms: *"Water damage restoration service"* OR *"Fire and water damage restoration"*. The scrape form previously only had "water damage restoration service" as an option — missing the fire-restoration term entirely.

Fixed by adding a mapping layer rather than exposing both raw search terms in the form:

- Form dropdown now shows the short label **"Restoration"**
- `NICHE_SEARCH_TERMS` expands it to both real Apify search terms in one scrape (`searchStringsArray` takes a list — Apify runs both terms in a single actor call, deduped into one dataset)
- `NICHE_DISPLAY_NAMES` maps it to the full **"Water/Fire/Storm Restoration"** label when writing the `Niche` property in Notion, matching the option that already existed in the Outreach DB schema

**Cost note:** `maxCrawledPlacesPerSearch` in Apify applies *per search term*, not per scrape overall. For the "Restoration" niche specifically, a given Max Places setting can now crawl up to 2× that many raw places (before dedup) since two terms run per scrape, versus 1× for every other niche. Worth knowing when picking Max Places for a Restoration run.

## Max Places ceiling raised (Aug 21, 2026)

Deliberately scaling up scrape depth per city. Changes in this pass:

- **`max_places` ceiling raised from 50 → 500.** Not a real functional limit — Google Maps itself rarely surfaces more than ~120–200 results for a single search+location, so 500 only guards against an accidental typo (an extra zero), not normal usage.
- **Modal function timeout raised 420s → 1200s.** A deep fresh-city run can turn up hundreds of new (non-duplicate) leads, each needing a serial dedup check + classify call + throttled Outreach/Scrape-Log write — this gives real headroom instead of failing mid-run on a large city.
- **Apify's own actor timeout raised 240s → 600s**, and the httpx client wait raised 270s → 650s, so the scrape stage itself isn't the bottleneck before the higher ceiling is even reached.

If a single run turns out to need more room than this in practice, the next lever is parallelizing the dedup/classify/write loop instead of raising timeouts further — not done here, since the pipeline is still fully serial by design.

## n8n's own timeout was the real bottleneck (Aug 21, 2026)

Live-tested the raised ceiling with a real run: Restoration niche (2 search terms), Fresno CA, Max Places 500. Result: n8n's HTTP Request node has its **own default 300-second timeout**, completely independent of Modal's 1200s function timeout — nobody had touched it when Modal's budget was raised. The n8n node gave up and reported "Failed" at exactly 300s, while Modal was still correctly running in the background and went on to actually write 25+ real, correctly-classified leads to Outreach.

This meant a run could look failed in Scrape Queries while silently succeeding underneath — worse than a clean failure, since the accurate final `leads_added`/`leads_skipped`/`leads_failed` counts were never received by n8n either (it had already given up before Modal responded).

**Fixed:** set `options.timeout: 1300000` (~21.7 min) on the `Call Modal Scrape API` node — safely above Modal's 1200s ceiling. The stale Scrape Queries row from the test run was manually corrected in Notion (marked Complete instead of Failed, with a note explaining the real counts were lost to the timeout, not guessed at).
