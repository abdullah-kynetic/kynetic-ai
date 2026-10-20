# Lead engine pilot: Apify census for DFW roofing (2026-10-20)

Actor: `solidcode/meta-ads-library-scraper` (run `fisjWFkp9W2G0Dvpf`), US, ACTIVE ads only, 5 keyword searches, creative + advertiser details on, hard cap $2.
Account: Apify user `kyneticai`, FREE plan, $5 monthly usage cap (cycle ends 2026-10-29). Treg keys set in env: `TREG_API_KEY_KYNETICAI`, `TREG_API_KEY_BLITZ` (which holds the $1 is unconfirmed).

## Cost
- Apify run: $0.312 for 343 ads (about $0.91 per 1,000 with both add-ons; live pricing: start $0.005, ad $0.00048, creative $0.00012, advertiser details $0.00048).
- Firecrawl: 8 credits for the website link scrapes in this stage; the credit meter reads 910 of 1,000 remaining.
- Treg: not used yet.

## Funnel
343 ads -> 93 unique advertisers (by Page ID) -> 48 with a Texas signal in ad text/about/landing URL -> 33 with 2+ active ads -> about 27 real roofers (the rest were RV, trailer, sheet-metal and similar).
- Known Arlington answer key: Joe Hall found (11 active ads), Rainstone found (14), Proclaim found (2). Trustmark, Frame Restoration and JML were not found.
- Many top advertisers send people to Facebook instant forms (landing domain fb.me / fb.com / none), so the ad gives no website; their site and phone need a Maps lookup.

## Website checks (Firecrawl links, 1 credit each)
- Bert Roofing Inc: site phone 214-984-3018, ad copy phone 972-360-9690 (mismatch: tracking suspected); Dallas, family-owned since 1988.
- New View Roofing: 469-232-7220. Vaquero Roofing: 214-216-2290. Legacy Roofing (Crowley TX): 817-697-1501. Arrington Roofing: 214-698-8443 (BBB link and a team page for Chris Arrington on its site).
- Fort Tex Metals & Roofing: its site embeds an AI answering product (Alivo), so it likely already has AI lead response.
- Ruff Roofing: quiz funnel only, no phone. Berry Good Roofing: no phone link found.

## Muse batch (top 10 roofers by active ad count, excluding Joe Hall and Rainstone, already done)
Bert Roofing Inc (30), Ruff Roofing (16), Heirloom Roofing & Restorations (12), Johnny Walker Roofing & Construction (11), Verified Roofing LLC (8), Berry Good Roofing (6), DFW Roofing Inspections (6), MB Roofing and Reconstruction (6), Pursuit Roofing & Construction (5), Top Sun Roofing & Foundation (5).
