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

## Muse batch result and audit (2026-10-20)
Muse output: `docs/lead-engine-run-b-muse/pilot-batch-results.csv` (10 businesses).

Independent checks:
- Texas open data (franchise-tax permit holders) matches Muse's taxpayer numbers for Bert Roofing, Inc. (17522644784), Verified Roofing, LLC (32068529844, Bedford), Top Sun Roofing LLC (32088175297, SOS 0804905406), Heirloom Roofing & Restorations, LLC (32067054588), Johnny Walker Roofing & Construction, LLC (32085742685) and Berry Good Roofing and Efficiency LLC (32090825467). Berry Good's record shows right-to-transact "N", which agrees with Muse's FORFEITED flag; the registry city is Midlothian, Muse says Alvarado.
- Bert's owner quote matches the live About page word for word.
- Johnny Walker's site is behind a bot challenge, so the "Grace" AI receptionist claim (from a Google post) is unverified.
- Muse's headline said 7 DIAL_READY; the CSV has 6.
- Possible Muse miss: the registry lists PURSUIT ROOFING LLC (Southlake, formed 2025-04-12, right-to-transact N). Muse searched two other name variants. Not confirmed to be the Forney business.
- Bert's phone is unresolved: Muse reports the site at (214) 321-9341; a Firecrawl link scrape of bertroofing.com showed tel 214-984-3018; ad copy shows 972-360-9690; Google shows (469) 382-9436.
- Treg: one capped Hunter domain search for pursuitindustries.net returned 0 emails and cost $0.

Audited statuses: DIAL_READY Bert (phone to confirm), Top Sun, Heirloom (Sherman, north of DFW core), Verified Roofing. HOLD Johnny Walker (already has an AI receptionist), Berry Good (forfeited), Pursuit (unconfirmed owner). DROP Ruff, DFW Roofing Inspections, MB Roofing.

Cost: Apify $0.31, Firecrawl about 40 credits, Muse $0. Treg: $0 at this point; the later email/phone test cost about $0.049 (see docs/lead-engine-handoff.md).

## Code-only rerun with Firecrawl (2026-10-20)
`tools/lead_enrich.py` ran the same 10 businesses with no browser agent: Texas open data, Comptroller account page by taxpayer number, BBB (search then profile), business site and About page. Output: `docs/lead-engine-code-run/` (results.json, results.csv).
- Cost: 53 Firecrawl credits for the second run (48 for a first run that matched wrong BBB profiles and was discarded). About 5 credits and 5-15 s per business when not rate-limited; the whole run took 4 minutes because calls are paced against 429s.
- Owner names agreed with Muse on all 7 businesses where Muse found one (Bert, Ruff, Heirloom, Johnny Walker, Verified, Berry Good, Top Sun). Pursuit, DFW Roofing Inspections and MB Roofing: no owner, same as Muse.
- Phones: matched Muse for Heirloom, Verified, Berry Good, Top Sun, and Bert and Pursuit (one of several). Johnny Walker differs ((940) 735-6944 vs Muse (940) 412-8994). Ruff: code found (346) 339-3405 where Muse had none.
- What the code cannot do: judge geography (Ruff is Houston HQ, should stay DROP), read an AI receptionist claim (Johnny Walker), or decide which phone reaches the owner (Bert has three). Registry search by name is ambiguous for common words; it does not guess.
- First-pass bug found by checking: loose BBB name matching attached other businesses' owners to DFW Roofing Inspections, MB Roofing and Pursuit. Fixed by requiring the first two distinctive name words in the BBB URL.

## Screens added to the script, rescored offline (2026-10-20)
`tools/lead_enrich.py` now runs three screens after the fetch, and `--rescore results.json out_dir` reruns them on saved results with no API calls (0 credits). Output: `docs/lead-engine-code-run/rescore-2026-10-20/` (adds `phone_report.csv`).
- Geography/franchise: DFW core cities by BBB city or registry city, DFW area codes (214, 469, 972, 945, 817, 682, 940); never FL/OK; brand names checked against name and domain; franchise wording on the site goes to HOLD.
- AI answering: home page HTML is scanned for AI answering or AI follow-up products (Alivo, Smith.ai, Goodcall, Hatch, Retell, Vapi and others) and "AI receptionist" wording, which goes to HOLD. Chat or booking widgets (Podium, GoHighLevel, Birdeye...) are only noted. A bot-check page is noted as "check not done". The saved results have no HTML, so this screen did not run in the rescore.
- Phone report: each number with the sites it appears on. A number is picked only if it is the only one found, or the only one on two different sites; toll-free and FL/OK numbers are never picked.
- Registry: several hits are narrowed by the trade word in the name, then by BBB city. On the saved candidates this picks the right entity for Johnny Walker, Verified and Berry Good (forfeited, RTT N) and leaves DFW Roofing Inspections ambiguous. It takes effect on the next live run.

Rescore against the audited statuses (10 businesses):
| Business | Audit | Old script | Rescore |
|---|---|---|---|
| Bert | DIAL_READY (confirm phone) | HOLD | HOLD (3 numbers, each on one site) |
| Ruff | DROP | DIAL_READY | DROP (Houston, no DFW number) |
| Heirloom | DIAL_READY | DIAL_READY | DIAL_READY (noted outside core) |
| Johnny Walker | HOLD (AI receptionist) | DIAL_READY | DIAL_READY (miss: evidence is a Google post) |
| Verified | DIAL_READY | DIAL_READY | DIAL_READY |
| Berry Good | HOLD (forfeited) | DIAL_READY | DIAL_READY (expected HOLD on a live run, see registry) |
| DFW Roofing Inspections | DROP | HOLD | HOLD (lead-gen suspect, needs Maps) |
| MB Roofing | DROP | HOLD | HOLD (lead-gen suspect, needs Maps) |
| Pursuit | HOLD | HOLD | HOLD |
| Top Sun | DIAL_READY | HOLD | DIAL_READY (469 number on BBB and site; 407 FL number not dialed) |

Exact matches went from 3 to 5 of 10. Wrong-direction calls (DIAL_READY where the audit says HOLD or DROP) went from 3 to 2. The other 3 are cautious HOLDs. No API calls; $0.
