# Lead Engine: research, ICP and method (Lane A)

_Twenty note `84e7725d`, created 2026-10-12, updated 2026-10-25. Exported 2026-11-12._

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

# Lane A session: lead engine, ICP and niche research (Oct 10-12, 2026)
Plan 1 only (D-013). Phase 3 (outbound build) is Abdullah's and was not touched. Nothing was changed in n8n, Retell or Notion. No decision notes were edited; items below marked PENDING need Abdullah's yes before any decision note changes.

## 1. Treg (API gateway) test
- treg.to allowlisted in the cloud env; installer reviewed line by line (sha256 38f03a72...fa411) and run with no token; team kyneticai; balance $1.00 promo credit, **$0 spent**.
- Token was pasted in chat on Oct 10. **Rotate it in the treg dashboard.** Install only lived in an ephemeral cloud container.
- Catalog findings (prices per call): Meta Ad Library via scrapecreators $0.00188, apify $0.005/result, free official Meta API is gated and political-ad oriented; Google Maps routed $0.00175; web page extract $0-$0.001; phone find routed $0.0048 up to $0.75 (mostly needs LinkedIn URL or owner name + domain); HLR line check $0.0066-$0.013. No BBB, no owner lookup.
- Verdict: cheap for discovery, weak for owner personal cells. Not used yet. Kept as an option.

## 2. Owner phone reality
- Businesses running ads often do not answer the main line; Maps numbers are business/tracking lines, not owner cells.
- Free public path: Ad Library -> site Contact/About + Facebook Page About -> owner name from BBB / Texas Comptroller -> person-level lookup only for gaps. Apollo or ownerphones.com for gaps (Oct 1 handoff: get a quote first). No people-search/data-broker sites.
- Apify: 5 free accounts to split one workload may breach Apify terms; prefer one account with a spend cap.
- Decision taken in chat: go back to **Muse** (free) with much tighter prompting, Claude audits the output.

## 3. ICP thresholds (working, from this session)
- Price (D-017, final): $4,675 (first 3 clients) / $8,500 3-month package. ~~$1,500 setup + $997/mo; first three months = $4,491~~ (superseded).
- Revenue $150k+/mo = easy yes; $80-150k workable; under $50k fail.
- Meta leads 150+/mo easy yes; 75-150 workable; under 75 fail. Meta spend $5k+/mo easy yes; $3-5k workable.
- Payback: incremental profit should be at least 2x the fee. Threshold to be re-run on D-017 numbers (~$1,560/mo for tier 1, ~$2,830/mo for tier 2 over 3 months); not confirmed.
- **Correction recorded:** the product calls the business's *leads*, not inbound callers. A receptionist/front desk does not matter for fit; the real exclusion is a dedicated instant-response inside-sales team or call center. Team size is not a filter. Fit (buys Meta leads, follows up slowly) is separate from reachability (can we reach the owner/GM who signs).
- PENDING: reword D-002 to "no dedicated instant-response call center" instead of "no receptionist or front desk".

## 4. Niche research (two deep-research reports, audited)
- Report 1: arithmetic correct but implied Meta = 75-130% of revenue; roofing $15k ticket vs Abdullah's $2.5k assumption.
- Report 2 (47 niches, sourced URLs): all payback math and weighted scores recompute correctly; source mixes sum to 100%. Main flaw: one fixed ~0.8pp close-rate lift for every niche, which inflates low-close high-ticket niches (kitchen, pool, custom homes) and understates med spa / garage floors. Active-advertiser revenue (roofing P25 $220k/mo) and DFW counts (45 roofers) look optimistic vs Muse's 25 Dallas advertisers. Sources could not be opened from the cloud session (firecrawl 403).
- Corrected payback (20% relative lift, x of $997 fee): dental implants 7.9, bath 5.8, med spa 5.6, wedding venues 5.0, windows & siding 4.5, garage floors 4.2, foundation 3.9, pool 3.6, outdoor living 3.1, generators 2.8, landscape 2.8, roofing 2.6, HVAC 2.4, painting 2.3, kitchen 2.1.

### Top 7 (least to worry about, most willingness, nationwide)
1. Bath remodel (independents) - year-round
2. Foundation repair & waterproofing - year-round
3. Windows & siding (independents) - mostly year-round
4. Garage floor coatings - Sun Belt year-round, North seasonal
5. Roofing, replacement-led - Sun Belt year-round, North seasonal; demo already built
6. Med spa - year-round; HIPAA/medical rules, heavy vendor saturation
7. HVAC replacement - year-round; many shops already have fast dispatch
Alternates: dental implants (best payback, more to manage), kitchen (year-round, thin payback).
Avoid for now: solar, personal injury, insurance, mortgage, addiction treatment.

### Compliance noted
- FCC Feb 8, 2024: AI voices count as artificial voice under TCPA. Every client lead form needs counsel-approved consent covering AI calls. Add to 1.4.
- State laws to check before client go-live: Florida (FTSA), Oklahoma. HIPAA work needs BAAs with every vendor touching PHI (Retell, Twilio, n8n, CRM).

## 5. Geography
- 30 metros in three waves. Wave 1 Texas: DFW, Houston, San Antonio, Austin. Wave 2: Atlanta, Phoenix, Charlotte, Nashville, Denver, Kansas City, Raleigh-Durham, Las Vegas, St. Louis, Indianapolis, Columbus, Cincinnati, Louisville, Birmingham, Memphis, Salt Lake City, Greenville-Spartanburg, Chicago, Minneapolis-St. Paul, Richmond. Wave 3 (counsel check first): Oklahoma City, Tulsa, Tampa, Orlando, Jacksonville, Miami-Fort Lauderdale.
- DFW zones: North (Plano, Frisco, McKinney, Allen, Prosper, Celina, Little Elm, The Colony, Lewisville, Flower Mound, Denton, Carrollton); East (Richardson, Garland, Rowlett, Rockwall, Wylie, Sachse, Murphy, Mesquite, Forney, Royse City); Mid-Cities (Irving, Coppell, Grapevine, Southlake, Colleyville, Keller, Hurst/Euless/Bedford, North Richland Hills, Arlington, Grand Prairie); Fort Worth & west (Fort Worth, Lake Worth, Haltom City, Benbrook, Aledo, Weatherford, Burleson, Crowley, Mansfield); South (Cedar Hill, DeSoto, Duncanville, Lancaster, Midlothian, Waxahachie).
- Houston: Katy, Sugar Land, The Woodlands, Cypress, Spring, Tomball, Conroe, Humble/Kingwood, Pearland, Friendswood, League City, Clear Lake, Missouri City, Richmond/Rosenberg, Baytown, Pasadena. Beaumont-Port Arthur is its own metro.
- San Antonio: New Braunfels, Boerne, Schertz, Cibolo, Helotes, Universal City, Seguin, Alamo Heights, Stone Oak. Austin: Round Rock, Cedar Park, Leander, Georgetown, Pflugerville, Hutto, Lakeway, Bee Cave, Dripping Springs, Kyle, Buda, San Marcos.
- Method: Ad Library by niche + 2-3 anchor suburbs per zone; Google Maps per suburb for businesses that never name a city in ads; dedupe by Facebook Page. Scrape order: North DFW, Mid-Cities, East/Fort Worth/South (roofing, foundation, garage, HVAC), Houston, Austin and San Antonio.

## 6. PENDING decisions (Abdullah)
1. Launch niche: keep roofing (D-015, demo built) or switch to foundation (scored higher).
2. Second niche: D-015 says kitchen & bath; research says bath, foundation, garage floors or windows instead.
3. Revenue floor: hard $150k, or ~$100k for garage floors / wedding venues.
4. D-002 rewording (section 3).
5. Counsel 1.4: add AI-voice consent wording for client lead forms and state-law check (FL, OK).

## 7. Next step
Run the Muse Wave 1 prompt (note: MUSE PROMPT: Wave 1 North DFW census), zone by zone, then Claude audits the CSV against the ICP.

See also: HANDOFF LANE A, SESSION WRAP Oct 1, D-002, D-013, D-015, PLAN 1: NEXT 10 STEPS.

---

## Merged from: HANDOFF LANE A: Lead engine (Muse vs own agent), start here (original note 46cf50c7, archived Oct 13, 2026)

**Paste into the new chat:** "Read the Twenty notes: SESSION WRAP: Oct 1, 2026; MASTER PLAN: Launch ready order; ACTIVE PLAN: Meta Ads Speed to Lead; SOURCE LIBRARY. You are Lane A, the lead engine. Continue from this note."

## Goal
A repeatable way to produce owner gated, qualified roofing (and later other niche) leads with clickable links on every row, loaded into Twenty. Decide whether Muse can be that engine, or whether to build an own agent.

## What is established
- Muse works in a live browser, needs no login for the Ad Library, and produced a 25 row roofing Dallas CSV with sources and honest "unknown" values. See SESSION WRAP for the audit and the A, B, Hold, Drop sorting.
- It is weak at confirming location and at owner or front desk evidence. It has not yet been tested on owner names or direct numbers.
- Phones it returned are business lines, often toll free or tracking numbers.

## The decision to make
Use Muse as the engine, build an own agent, or a mix (Muse for discovery, own scripts and tools for enrichment).

## How to decide (test, then compare)
1. Re run the same roofing Dallas query a second time. Do the results match? (repeatability)
2. Run a second niche (kitchen and bath or foundation repair) and a second metro. (generalizes?)
3. Run the owner pass on groups A and B (14 businesses): owner name with source link, owner operated vs front desk with evidence, staff or location count, direct vs main line. Public business sources only. No people search or data broker sites.
4. Score each run on: unique independent advertisers per run, share that passes the owner gate, share of fields with a clickable source, time per run, cost, and how often it breaks.
5. Compare against the cost and effort of an own agent (Apify Ad Library scraper at about $0.75 per 1,000 ads plus n8n and enrichment).

## Output format required
A Google Sheet or CSV where every row has clickable links: facebook_page_url, website_url, ad_library_url, google_maps_url, bbb_url, and a source_url next to each owner and location claim. Abdullah does not want to check pages by hand.

## Cautions
- Do not give Muse a personal Facebook login. The Ad Library is public and needs none. If a login is ever needed, use a separate business account, and expect Meta may restrict accounts that scrape while logged in.
- Extra scraping API keys or sites can be tried later. Keep a spend cap.
- Owner numbers must come from public business sources or legitimate enrichment tools (Apollo, ownerphones.com for gaps, get a quote first). Record the source of every number in Twenty.
- To Claude's knowledge Texas has no state roofing license; use the website About page, BBB, Google Business Profile and Texas Secretary of State filings for owner names.

## Path to Twenty
Muse or own agent to Google Sheet (staging), Claude audits (owner gate, ad destination, duplicates), then only passing rows load into Twenty as Companies with the source of each fact. Dedupe by Facebook Page, domain and phone.

## Target
150 plus owner gated numbers for one niche, refilling automatically.

---

## Merged from: Outreach Research (Sep 24 to 25) (original note 2b0d731d, archived Oct 13, 2026)

Research and analysis from the Sep 24 to 25 session. Reference only; the active plan is "Meta Ads Outreach Plan (Launch Mon Sep 28)".

## Outreach methods ranked for the Meta advertiser list
1. Cold calling (main channel, free, legally clean)
2. A personal response time result as the hook ("you took 41 hours to respond")
3. Facebook Messenger to their business page, by hand, 10 to 20 a day
4. One handwritten text after a missed call, from your own phone
5. Cold email (needs a separate domain and about 2 weeks of inbox warm up; legal under CAN-SPAM with address and opt out)
6. Personal demo video for hot leads
7. Partnering with Meta ad agencies (one partner can bring 5 to 20 clients; start after first case study)
8. Businesses hiring receptionists or appointment setters (Indeed) as a second list
9. Walk ins (Bay Area only)
10. Referrals and networking groups (month 2 and later)
Skip for now: direct mail, LinkedIn for this list, paid ads for Kynetic, contractor Facebook groups.
**Avoid:** cold texting at scale, ringless voicemail drops, AI placing cold calls.

## Cold SMS analysis (videos reviewed Sep 24 to 25)
- Common setup in the videos: GoHighLevel plus a texting provider (TextGrid, Signal House, or Sendivo), a Google Maps lead list, mobile number checking (Clearout Phone), drip sending during business hours, 3 message sequences, 4 message versions split tested, call anyone who replies within 5 minutes.
- Best data point: Sendivo video, about 200,000 texts over 3 weeks, 48.7% delivered, 2.12% reply, 0.12% opt out; claims 4 to 10% reply with a good mobile list.
- Red flags in the videos: registering A2P under a customer care use case then sending cold marketing, chat widget consent that doesn't cover scraped numbers, fake sender names, misleading openers, masking toll free numbers, reusing one registration across businesses, extra sub accounts to dodge bans.
- Legal: TCPA covers texts; Do Not Call rules apply to texts; strict state laws (Florida, Oklahoma, Maryland). Kynetic is a sole proprietorship, so liability is personal. An LLC helps but courts can still hold a person liable if they personally directed the texting.
- Decision: not doing cold SMS at scale for now. If tested later: separate provider (never the Twilio account Nora uses), honest opener with a clear reply stop line, list scrubbed against Do Not Call, strict states skipped, 100 to 150 a day, lawyer read first.

## Compliance flags
- FCC (2024): AI generated voices count as artificial voice under the TCPA, so outbound AI calls need prior consent. Leads who submit a form with consent wording are fine; never use AI to call prospects.
- FCC (2022): ringless voicemail counts as a call under the TCPA. Ringless drops (Slybroadcast) need consent.
- Client A2P registration takes 2 to 3 weeks; start it the day a client signs.

## Notes on the Meta ads plan audit
- Strongest upgrade not in the plan: submit their form first and use the measured response time in the opener. Decided Sep 25 to run the plan exactly as written, so this is not part of the active plan.
- Combining both targeting methods (Meta advertisers plus 100+ Google reviews) gives the best list, also not part of the active plan.
