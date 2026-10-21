# Niche audit for the national lead database (2026-10-21)

Question: do the 7 niches already in Twenty ("Kynetic Prospecting Plan": bath, roofing, foundation/waterproofing/crawl space, windows/doors, HVAC, siding, standby generators; kitchen as first alternate) cover the high-ticket home-service niches, and are they the right ones to scrape first?

## Method
One Treg call per niche and city (`anyapi.facebook.ads_search`, ACTIVE ads, US, about $0.0011 per call, 20 niches x Dallas and Houston, $0.044 total). The count is ads returned on the first page (maximum about 30), so it is a rough density signal only, and it depends on the exact keyword. Ticket sizes for the 7 existing niches are the Angi averages recorded in Twenty. Ticket sizes marked (est.) are my estimates, not verified.

## Meta-ad density (first page, advertisers in brackets)
| Niche | Dallas | Houston | Read |
|---|---|---|---|
| Roof replacement | 17 (10) | 26 (16) | Strong |
| Bathroom remodel | 13 (9) | 13 (8) | Strong |
| Kitchen remodel | 15 (6) | 16 (11) | Strong |
| Foundation repair | 16 (11) | 30 (8) | Strong; Houston is one big spender |
| Window replacement | 28 (7) | 27 (18) | Strong, but franchise-heavy |
| Fence installation | 23 (6) | 26 (6) | Good (est. $4-8k) |
| Driveway / concrete | 11 (9) | 9 (6) | Good, small shops (est. $3-8k) |
| HVAC replacement | 8 (1) | 17 (8) | Weak: one advertiser (Royal Air) dominates |
| Standby generator | 1 (1) | 8 (6) | Thin |
| Siding | 0 | 1 | Almost none; siding is sold inside roofing ads |
| Water / fire damage restoration, mold | 0-1 | 0-2 | Almost no Meta ads |
| Pool installation, garage door, painting, repipe, basement waterproofing | 0 | 0-1 | None found (could be keyword mismatch) |
| Solar | 1 | 4 | Thin, and mostly lead-gen or finance pages |

## Findings
- The Twenty list already covers bath, roofing, foundation, windows, siding, HVAC and generators. It does not include kitchen (listed only as an alternate), restoration (fire, water, mold), fencing, concrete or pools.
- Kitchen remodel (Angi $26,990 in Twenty) is as dense as bath and roofing. Move it from alternate to the main list.
- Restoration is high ticket, but restoration companies buy Google Search and Local Services Ads for emergency calls, not Meta lead-form ads. The Meta-ad census cannot find them. Calls to them are also inbound-emergency, which fits speed-to-lead less well. Treat it as a later source (Google Maps and LSA), not part of this Meta pipeline.
- Generators and HVAC are thin or dominated by one advertiser. Siding is mostly bundled with roofing.
- Fencing and concrete show up in the data and are a plausible $4k and up. They are not in the plan yet; I have not verified their ticket size.

## Recommendation (needs your decision)
1. Scrape now: roofing, bath, kitchen, foundation, windows.
2. Add as a test batch: fence, concrete. Keep siding (bundled with roofing).
3. Hold: HVAC, generators, solar, pools (thin or dominated by one advertiser).
4. Restoration: separate source later; not a Meta-ads niche.

`tools/lead_engine.py` takes the niche as `--niche` and the table is `NICHES` at the top of the file, so changing the list is a one-line edit.
