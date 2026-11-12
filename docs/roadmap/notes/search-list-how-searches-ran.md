# Search List + How Searches Ran

_Twenty note `c486c451`, created 2026-10-14, updated 2026-10-25. Exported 2026-11-12._

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

# Search list + how searches actually ran
Attach: research/search-queries.csv (5,539 rows; columns metro, city, niche, phrase, query, wave1, near_ok_border). Also attach research/demo/wave2-raw.csv, wave3-raw.csv and wave4-raw.csv.

## Planned list (search-queries.md)
- Each search is "<phrase> <city>", run in the Meta Ad Library and Google Maps. FL and OK are excluded.
- 191 cities in 15 metros, 5,539 searches. Wave 1 is 796 searches: DFW bath and foundation, Houston bath and foundation, San Antonio roofing, Atlanta roofing.
- Phrases: bath (bath remodel, bathroom remodel, shower replacement, walk-in shower, walk-in tub, tub to shower conversion); roofing (roofing, roof replacement, roofer, new roof, roof repair); foundation (foundation repair, slab foundation repair, pier and beam repair, basement waterproofing, crawl space repair); windows (window replacement, replacement windows, door replacement); hvac (HVAC/AC/furnace replacement, heat pump installation); siding (siding replacement, siding installation, James Hardie siding); generators (standby generator, Generac installer, whole home generator).
- Searches per metro: DFW 35 cities/1,015; Houston 21/609; San Antonio 14/406; Austin 15/435; Atlanta 22/638; Phoenix 16/464; Nashville 9/261; Charlotte 10/290; Kansas City 9/261; St. Louis 7/203; Indianapolis 7/203; Raleigh 7/203; Denver 9/261; Birmingham 5/145; Greenville 5/145.
- Sherman, Denison and Gainesville TX sit near the Oklahoma border, so check each advertiser's address. Per-city income: not confirmed.

## What actually ran (Scout)
- The planned list was NOT run in full.
- Ad Library URL: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=<term>&search_type=keyword_unordered
- Google Maps searches looked like "<niche> <City> <ST>". The exact Maps URL format is not confirmed.

| Wave | File | Rows | Method | Active Meta ads | PASS / FAIL / HOLD of verified |
|---|---|---|---|---|---|
| Rerun Oct 13 | rerun-raw.csv | 154 | Ad Library + Maps | 80 | 24/9/100 of 133 |
| Wave 2 | wave2-raw.csv | 149 | Maps, then Ad Library name check | 16 | 19/9/114 of 142 |
| Wave 3 | wave3-raw.csv | 151 | Maps, then Ad Library name check | 21 | 21/9/107 of 137 |
| Wave 4 | wave4-raw.csv | 124 | Ad Library (59) + Maps (65) | 59 | 2/7/54/5 DROP of 68 |
| Maps ad check | maps-adcheck.csv | 49 | Ad Library name check | 8 | n/a |

- Many HOLDs were re-checked later and promoted, which is why the dial-ready count is higher than the PASS counts.
- The rerun capped the Ad Library at 30 searches, so 49 rows are "not checked (30-search cap)". The earlier 15 hand-search terms are in research/adlib-queries.csv.
- Wave 4 metros: Kansas City, Atlanta, Tyler, Waco, Beaumont, Lubbock, Charlotte, Amarillo, Killeen/Temple, McAllen, Nashville, Corpus Christi. Wave 4 also searched kitchen remodel (Charlotte, KC). Neither those Texas metros nor kitchen are in the 15-area / 7-niche plan.

