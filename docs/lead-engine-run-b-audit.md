# Lead engine Run B: audit of Claude+Firecrawl vs Muse (2026-10-19)

Sample: Arlington TX roofing. Claude run: `docs/lead-engine-run-b-claude-results.md`. Muse run: `docs/lead-engine-run-b-muse/` (uploaded output, unedited). The Claude run was not blind (same session wrote the prompt); the Muse run was finished in a second pass after an early stop.

## Independent checks done in the audit
- Texas open data (data.texas.gov franchise-tax permit holders, fetched through Firecrawl): Joe Hall Roofing, Inc. taxpayer 17522938715, SOS file 0112355400, ACTIVE, chartered 1989-08-14; Rainstone Roofing Company taxpayer 32100681793, SOS file 0806079555, ACTIVE, formed 2025-06-12, mailing address San Antonio PMB. Matches Muse exactly. The officer names and registered agent come from the Public Information Report, which that dataset does not hold, so those are not independently verified.
- Rainstone homepage HTML: contains 214-393-5217, 817-646-7113, schema phone +18176316920 and a CallRail script (matches Muse). 210-987-9600 was not on the homepage (Muse says it is on a slate-roofing page; not checked).
- Joe Hall homepage: only 817.274.6777, no tracking script (both runs).
- JBA = Washington company, Proclaim phone 972.984.7663, Frame Restoration HQ Frisco: verified.
- Not verified: Arlington permit portal result, Google reply signatures, Muse's Facebook page counts, Muse's ad count of 9 for Joe Hall (the Claude run saw 4 distinct ads, oldest Aug 12, which matches Muse's date).

## Scorecard
| Criterion | Claude + Firecrawl | Muse |
|---|---|---|
| Arlington-area advertisers qualified | 3 (Joe Hall, Rainstone, Trustmark) | 2 (Joe Hall, Rainstone) |
| DIAL_READY | 2 (+1 HOLD) | 2 |
| Owner names | Joe Hall HIGH; Rainstone, Trustmark MEDIUM (no registry access) | Both HIGH, backed by Comptroller records |
| Chosen phones | (817) 274-6777; (817) 646-7113 | same two |
| Rainstone tracking flag | yes (verified) | yes (verified) |
| Joe Hall tracking flag | no | yes, which over-flags (every source matches; the extra numbers are BBB-only) |
| Fabricated cells | none found | none found |
| Ad evidence | Library IDs with direct ad links | search URLs only, page URLs mostly "unknown" |
| Census noise | about 22 rows, mostly DFW | 68 rows, mostly out-of-region |
| Maps roofers checked for ads | no | 14 checked by exact name, then DROPped as "no ads found" although the run itself says exact-name search undercounts (Joe Hall exact-name returned zero) |
| Missed | Comptroller, permit portal, Google reply signatures, Maps-roofer ad check | Trustmark Exteriors |
| Cost / time | about 62 Firecrawl credits; time not measured | 36 min, 0 Firecrawl credits; model/browser cost not visible |

## Findings
1. Two independent runs reached the same two businesses, owners and phone numbers. That agreement is the strongest quality signal in this test.
2. Muse's browser got the registry data (HIGH confidence) and the permit portal; Firecrawl could not submit those forms.
3. Firecrawl was cheaper and left better ad links, and it found a third advertiser.
4. Muse's "no active Meta ads found" DROPs for 14 Arlington roofers are not reliable and should be HOLD until checked by Page URL or domain.
5. Yield is low: two dial-ready businesses for one city after about 60 minutes of agent work. The launch target needs about 3,000 owner-gated numbers.
6. Neither dial-ready firm is a clear fit for the offer: Joe Hall is a 37-year firm with an office manager and a sales team; Rainstone is about a year old.

## Recommendation
Hybrid: wide census and cheap lookups through Firecrawl; browser agent only for form-gated records (Comptroller, city permit portal) and for Google place pages. Verify ads by Facebook Page URL, not exact-name keyword search.
