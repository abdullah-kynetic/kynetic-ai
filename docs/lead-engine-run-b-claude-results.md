# Lead engine Run B: Claude + Firecrawl results (Arlington TX, roofing)

Prompt: `docs/lead-engine-run-b-prompt.md`. Run on 2026-10-19 by Claude in the same session that wrote the prompt, so this run is not blind: it knew the prompt's design and had already tested the Ad Library scrape. Muse's run is the other half of the comparison. Both need an independent audit.

## A. Run header
- Tools: Firecrawl MCP (scrape with actions/scroll, search, links, json extract). No browser login, no paid enrichment, no people-search sites, nobody contacted, no forms submitted.
- Date: 2026-10-19. Wall-clock time: not measured.
- Ad Library searches run: 14 (the cap). Other pages loaded: about 25 (Google Maps x2, company sites, BBB x3, chamber, GAF, roofingcontractors.org, landing pages, one failed OpenCorporates attempt, Comptroller form page). Firecrawl searches: 8.
- Credits used: about 62 of the ~200 cap (JSON extraction costs 5 credits a page vs 1 for markdown; three JSON runs cost 15).
- Stopped because: the 14-search cap was hit, and only 4 advertisers had any evidence of an Arlington presence, so the enrichment set is 3 (+1 dropped), not 10.

Assumptions and deviations from the prompt:
1. Facebook's keyword search is text, not geographic. "Arlington" alone returned Arlington WA, Arlington Heights IL, Arlington County VA and Upper Arlington OH. I switched to "Arlington Texas", "Fort Worth", "DFW", "Mansfield Texas", "Grand Prairie Texas" and "North Texas" (searches 5-14).
2. The prompt's location rule needs an address in Arlington or an adjacent city. I confirmed addresses through a Google Maps search ("roofing contractor Arlington TX") and each company's BBB/GAF/chamber listing. Many DFW advertisers say only "DFW" in their ads, so I marked them HOLD "location unconfirmed" instead of guessing.
3. The "Arlington + roof replacement" JSON extraction returned 0 ads. I did not rerun it, so I can't say whether that was a true zero or an extraction miss.
4. The Google Maps pages came back in French/German (proxy locale). Facts below were read from them; quotes from the German page are translations and are not used as owner evidence.

Searches (term -> approx ads on page, relevant): 1 roof replacement Arlington (13, none Texas except Joe Hall) | 2 roof replacement Arlington TX (0 extracted) | 3 free roof inspection Arlington TX (1, a car dealer) | 4 roofing Arlington Texas (4) | 5 roofer Arlington Texas (1) | 6 roof repair Arlington Texas (0) | 7 storm damage roof Arlington Texas (1, a tree service) | 8 roofing estimate Arlington Texas (1) | 9 new roof Arlington Texas (2) | 10 roof replacement Fort Worth (~65 results, first ~16 cards read) | 11 roofing DFW (~260 results, first ~28 cards read) | 12 roofing Mansfield Texas (2) | 13 roofing Grand Prairie Texas (0) | 14 roofing North Texas (~110 results, first ~28 cards read). Only the first page of the three large searches was read; no deeper scrolling was done.

## B. Census (roofing/exterior advertisers; `ad_library_url` opens one active ad)
```csv
business_name,facebook_page_url,ad_library_url,active_ads_seen,oldest_seen_start,ad_destination,landing_page,city_evidence,owner_named_in_ad_copy,keep_or_drop,reason
Joe Hall Roofing,https://www.facebook.com/joehallroofing/,https://www.facebook.com/ads/library/?id=1089026666844372,4,"Aug 12, 2026",landing page (5-step quiz form),https://joehallroofing.com/lp-quiz,"Arlington, 1925 W Pioneer Pkwy (BBB, Maps, GAF)",no,KEEP,
Rainstone Roofing Company,https://www.facebook.com/Rainstoneroofing/,https://www.facebook.com/ads/library/?id=1675171143514729,2 (one shared by 3 ads),"May 13, 2026",landing page (Get Quote),https://roofsoveryourhead.com/roof-repair-replacement-promo/,"Dalworthington Gardens/Arlington, 2104 Roosevelt Dr Ste Q (BBB, chamber, Maps)",no,KEEP,
Trustmark Exteriors,https://www.facebook.com/trustmarkexteriors/,https://www.facebook.com/ads/library/?id=4538808029689916,2,"Sep 11, 2026",landing page (windows),https://www.trustmarkexteriors.com/lp-windows/,"Fort Worth 76140, 2832 SE Loop 820 (Maps); ads name Arlington",no,KEEP,windows-first (see enrichment)
Proclaim Roofing,https://www.facebook.com/proclaimroof/,https://www.facebook.com/ads/library/?id=1461612312526215,1,"Oct 16, 2026",landing page,http://www.proclaimroof.com/,"Plano HQ per site title; ad says Fort Worth and Arlington",no,DROP,"multi-state: own site lists TX, MO and OK service areas"
J9 Roofing,https://www.facebook.com/61590225310931/,https://www.facebook.com/ads/library/?id=1080520687751487,1,"Sep 1, 2026",landing page,https://j9roofing.com/,"ad: Hurst, Euless, Bedford, Dallas",no,HOLD,location unconfirmed
Priority Contracting and Roofing: Fort Worth,https://www.facebook.com/prioritycontractingfortworth/,https://www.facebook.com/ads/library/?id=3520031648160877,1,"Oct 8, 2026",instant form,https://priorityroofs.com/location/fortworth/,Fort Worth,no,HOLD,location unconfirmed
Bert Roofing Inc,https://www.facebook.com/BertRoofingInc/,https://www.facebook.com/ads/library/?id=4545982919023977,3 IDs (one shared by 6 ads),"Jul 30, 2026",call (972-360-9690 in ad copy),,"ad: Dallas-Fort Worth Area",no,HOLD,location unconfirmed
Fort Tex Metals & Roofing,https://www.facebook.com/ftmroofing/,https://www.facebook.com/ads/library/?id=4437809656510565,2,"Aug 3, 2026",landing page,https://www.ftmandroofing.com/lp-roof-inspection/,Fort Worth,no,HOLD,location unconfirmed
Bluebonnet Construction and Roofing,https://www.facebook.com/61594854520420/,https://www.facebook.com/ads/library/?id=1125560140000534,2,"Oct 12, 2026",landing page (Get Quote),https://go.bluebonnetroofingtexas.com/lp/roof-inspection/,"ad: Aledo",yes: "Cody, the owner, handles every estimate himself.",HOLD,location unconfirmed (Aledo)
Berry Good Roofing,https://www.facebook.com/BerryRoofs/,https://www.facebook.com/ads/library/?id=2110257582921523,2,"Oct 6, 2026",landing page (quiz),https://estimate.berrygoodroofs.com/insurance-estimate,"ad: Dallas Fort Worth",no,HOLD,location unconfirmed
Home Quality Solutions LLC,https://www.facebook.com/HomeQualitySolutions.LLC/,https://www.facebook.com/ads/library/?id=2588565224901824,3,"Oct 15, 2026",landing page (online estimator),https://instant.homequalitysolutions.com/,"ad: Dallas",no,HOLD,location unconfirmed
Cobra Roofing and Construction,https://www.facebook.com/61574478839877/,https://www.facebook.com/ads/library/?id=29418338144424339,1,"Oct 15, 2026",landing page (book now),https://cobraroofinglanding.com/,"ad: White Settlement and Fort Worth",no,HOLD,location unconfirmed
Prime Fix Fort Worth,https://www.facebook.com/61585062550444/,https://www.facebook.com/ads/library/?id=1497126015597719,1,"Oct 18, 2026",message / call,,"ad: Fort Worth, Saginaw, Haltom City, North Richland Hills",no,HOLD,location unconfirmed
Shalom Roofing LLC,https://www.facebook.com/100091523234457/,https://www.facebook.com/ads/library/?id=2968621783500769,1,"Oct 15, 2026",call/message,,"ad: Dallas-Fort Worth",no,HOLD,location unconfirmed
JBA Construction,https://www.facebook.com/61588009943899/,https://www.facebook.com/ads/library/?id=1058523753265822,1,"Jul 20, 2026",landing page (Get Quote),https://quote.thejbaroofpro.com/,not stated,no,HOLD,location unconfirmed
S&S Roofing,https://www.facebook.com/SSROOFINGLLC/,https://www.facebook.com/ads/library/?id=2669495123392214,1,"Oct 29, 2025",landing page,http://www.sandsroofingllc.com/,"ad: Arlington WA",no,DROP,out of area (Washington)
Brothers Roofing and Construction,https://www.facebook.com/brothersroofingconstruction/,https://www.facebook.com/ads/library/?id=1342924497958396,1,"Jul 26, 2026",landing page,https://upperarlingtonroofingcompany.com/,"ad: Upper Arlington",no,DROP,out of area (Upper Arlington; ad cites an HIC licence)
Timeproof USA,https://www.facebook.com/61580078009855/,https://www.facebook.com/ads/library/?id=1713632333030088,1,"Sep 24, 2026",landing page (remodelprofinder),https://timeproofusa.remodelprofinder.com/roofing/estimate,"ad: New England winters",no,DROP,out of area / lead-gen funnel
Long Home - Roof Replacements,https://www.facebook.com/61582878506810/,https://www.facebook.com/ads/library/?id=28283399388010392,1,"Sep 6, 2026",landing page,https://www.usaroofingexperts.com/lhroofing,"ad: Arlington County",no,DROP,lead-gen / out of area
Caitlyn Stubbs (americanroofers.org),https://www.facebook.com/homeprofessionals.org/,https://www.facebook.com/ads/library/?id=1471007338224034,2,"Oct 19, 2026",landing page,https://americanroofers.org/roofing,"ad: Arlington County",no,DROP,lead-gen / out of area
Senior Home Upgrade Program,https://www.facebook.com/61595181759087/,https://www.facebook.com/ads/library/?id=1473888594625306,1,"Oct 14, 2026",landing page,https://apply.greenhomesavings.com/,"ad: Arlington (unspecified)",no,DROP,lead-gen
PJ Fitzpatrick,https://www.facebook.com/61576303987524/,https://www.facebook.com/ads/library/?id=1048984631521989,2,"Sep 13, 2026",landing page (localremodelfinder),https://pj-fitzpatrick.localremodelfinder.com/roofing/estimate,"ad: Arlington County",no,DROP,out of area (Arlington County)
```
Other DFW roofing/exterior advertisers that appeared in searches 10-14 and were NOT assessed (location unconfirmed, no further work done): New View Roofing, PraiseWorthy Roofing, Swift Roofing & Designs, Texas General Roofing and Construction, Scott Exteriors, Newhaus Roofing & Construction, Proper Construction, Texas TrueHome Improvements, Shearman Roofing & Construction, VinMark Roofing & Construction, DT Roofing, Arrington Roofing, Platinum Roofing Pros, Verified Roofing LLC, Roofing & Restoration of North Texas, Structured Roofing Systems, DFW Roofing Inspections, Ascent Roofing & Restoration, Firehouse Roofing (appeared as a sponsored mention on a news page). Non-roofing results (trailer sellers, tree service, car dealer, auto glass, RV, sheet metal) were ignored.

## C. Enrichment (3 qualifying businesses + 1 dropped)
Only 3 advertisers had an address in or next to Arlington, so 3 rows were enriched instead of 10. All 3 were run through the full ladder as calibration.
```csv
business_name,facebook_page_url,website_url,owner_name,owner_role,owner_source_url,owner_quote,owner_confidence,owner_fact_type,entity_type,registry_source_url,registered_agent,phone,phone_source_url,phone_kind,tracking_suspected,owner_direct_status,front_desk_evidence,status,reason,notes
Joe Hall Roofing Inc,https://www.facebook.com/joehallroofing/,https://joehallroofing.com/,"Tina Hall; Brett Hall","CEO and Co-Owner; Co-Owner",https://joehallroofing.com/about-joe-hall-roofing/meet-the-team/,"Tina Hall Chief Executive Officer Co-Owner | Brett Hall Subject Matter Expert Co-Owner",HIGH,OBSERVED,Corporation (BBB: incorporated 8/14/1989),https://www.bbb.org/us/tx/arlington/profile/roofing-contractors/joe-hall-roofing-0825-1000132593,unknown (registry not queryable),(817) 274-6777,https://www.bbb.org/us/tx/arlington/profile/roofing-contractors/joe-hall-roofing-0825-1000132593,bbb,no,not_indicated,"team page lists Office Manager Michelle Fratto and 7+ sales consultants; GAF lists 'More than 5' employees; no call center seen",DIAL_READY,,"Same number appears on BBB, GAF, Yelp snippet and Google Maps. Company website phone not read. BBB also lists (817) 756-8501 and (877) 617-5777. Large established firm (since 1989, ~20 on team page, commercial arm statewide): fit as a slow-follow-up buyer is uncertain."
Rainstone Roofing Company,https://www.facebook.com/Rainstoneroofing/,https://roofsoveryourhead.com/,Gabriel Sutton,Managing Member (a directory says Owner),https://www.bbb.org/us/tx/dwg/profile/roofing-contractors/rainstone-roofing-company-0825-1000254659,"Business Management: Mr. Gabriel Sutton, Managing Member",MEDIUM,OBSERVED,LLC (BBB: formed 6/12/2025),https://roofingcontractors.org/tx/dwg/rainstone-roofing-company-roof-repair-replacement,"NORTHWEST REGISTERED AGENT, LLC (a commercial agent, not the owner); Comptroller ID 0806079555 per that directory",(817) 646-7113,https://arlingtontxcoc.weblinkconnect.com/Roofing-Contractor/Rainstone-Roofing-Company-16355,"chamber, bbb, google_profile",YES,not_indicated,none seen,DIAL_READY,,"Company site header shows 214-393-5217 (CallRail cookies listed on the page) and the ad landing page also has 214-972-2215, so use the 817 number, which matches BBB, chamber and Maps. Second source for the name is roofingcontractors.org ('Gabriel Sutton, Owner'); a registry listing was only available via that directory, not the Comptroller itself. Company is about 1 year old."
Trustmark Exteriors,https://www.facebook.com/trustmarkexteriors/,https://www.trustmarkexteriors.com/,Kameron Alexander,Managing Member (a news caption says Owner),https://www.bbb.org/us/tx/fort-worth/profile/roofing-contractors/trustmark-exteriors-0825-1000250766,"Business Management: Mr. Kameron Alexander, Managing Member",MEDIUM,OBSERVED,LLC (BBB: incorporated 10/23/2009),https://www.bbb.org/us/tx/fort-worth/profile/roofing-contractors/trustmark-exteriors-0825-1000250766,unknown,unresolved: (817) 968-1567 on own site and ad landing page is the best candidate,https://www.trustmarkexteriors.com/lp-windows/,website_main,YES,not_indicated,"none seen (site advertises a dedicated project manager per job)",HOLD,ads promote windows; roofing is secondary,"Five different numbers: site (817) 968-1567 and (817) 241-2393 (About page), Google Maps (817) 859-8369, BBB (877) 202-7663 and (817) 803-0573. Second source for owner: Instagram news-segment caption 'CAMERON ALEXANDER OWNER, TRUSTMARK EXTERIORS' (https://www.instagram.com/reel/DbHmSKMxOpn/), spelling differs. A LinkedIn search snippet 'Kameron Alexander - Owner, Vertical Roofing, Mansfield' is a different company; not used. Landing page calls it a 'family-owned window company'. Confirm a roofing ad actually runs before calling."
Proclaim Roofing,https://www.facebook.com/proclaimroof/,https://proclaimroof.com/,not researched,,,,,,,,,,,,,,,DROP,multi-state (TX, MO, OK),"Site title says Plano TX; lists West Texas, San Antonio, Lubbock, Houston, Missouri and Oklahoma service areas; shows Inc. 5000 badge. The page also contained unrelated pharmacy links (likely a compromised site)."
```

## D. Source scorecard (3 businesses; Proclaim not enriched)
| Step | Tried | Returned something | Usable owner name / phone | Blocked or unusable | Effort |
|---|---|---|---|---|---|
| Ad copy / landing page (name) | 3 | 0 | 0 names (Bluebonnet, outside the set, named "Cody") | quiz/form pages show no owner | low |
| Own website (name) | 3 | 3 pages | 1 of 3 (Joe Hall Meet the Team: HIGH) | Joe Hall /about-us 404 (right page found from the site's link list) | low |
| Facebook Page About | 1 | 0 | 0 | login wall / "page isn't available" | low |
| Google Business Profile reviews | 1 (Trustmark via Maps) | owner replies exist | 0 (unsigned) | Joe Hall and Rainstone place pages not read | medium |
| BBB profile | 3 | 3 | 3 of 3 named principal | none | low, best source |
| Texas Comptroller search | 1 | form page only | 0 | the lookup is a form that a static scrape can't submit (the page mentions API access) | n/a |
| OpenCorporates / SOS | 1 | 0 | 0 | OpenCorporates scrape failed; SOS not tried (login/fees) | n/a |
| County DBA | 0 | n/a | n/a | not applicable: all three are corp/LLC | n/a |
| Yelp / Angi / Houzz / Nextdoor | Yelp snippet only | address, phone | 0 names | Angi, Houzz, Nextdoor not read | low |
| Chamber of commerce | 1 (Rainstone) | listing | phone only, no contact name | others not found | low |
| LinkedIn via search snippet | 3 | 2 | 1 corroboration (Brett Hall, President) | Rainstone zero results; Trustmark returned a different company | low |
| GAF locator | 1 (Joe Hall) | profile | 0 names; address, phone, '>5 employees' | others not searched | low |
| Third-party directory (roofingcontractors.org) | 1 | profile | name + registry facts for Rainstone | secondary source | low |
| Phone: own website | 3 | 3 | 3 numbers, Rainstone and Trustmark look like tracking | Joe Hall header number not read | low |
| Phone: BBB / Maps / chamber | 3 / 3 / 1 | all | consistent for Joe Hall and Rainstone | Trustmark inconsistent | low |
| Phone: Arlington permit portal | 0 | portal found (ap.arlingtontx.gov, has "Search for a Contractor" and Reroof Permit) | 0 | form needs interaction; not run | n/a |

## E. Blocked / failed log
- `facebook.com/joehallroofing/about`: login wall / "This page isn't available right now".
- `opencorporates.com/companies?...q=trustmark+exteriors`: all Firecrawl engines failed.
- `mycpa.cpa.state.tx.us/coa/` (redirects to comptroller.texas.gov franchise tax search): returns the empty search form; results require a form submit.
- `joehallroofing.com/about-us/`: 404.
- Arlington permit portal contractor search: needs interactive form; not run.
- Ad Library searches 2, 6 and 13 returned no ads; search 2 may have been an extraction failure rather than a true zero.
- LinkedIn search for Rainstone's owner: zero results.
- Google Maps UI language varied (French, German).

## F. Self-audit
- Rows where every non-unknown cell has a source URL: 3 of 3. Owner names rely on BBB (self-reported by the business), not a government registry, for 2 of 3; none came from the Comptroller or Secretary of State directly.
- Cells I doubt: (1) Joe Hall as an "independent" fit (large, long-established); (2) Rainstone "Managing Member = owner" (a directory says Owner, the company site never names anyone); (3) Trustmark's whole row (ads are windows, 5 conflicting phones, spelling Kameron/Cameron); (4) the Joe Hall company-site phone, which I never read.
- Tempted to guess and did not: Trustmark's best phone; whether Rainstone's 214 number is a tracking line (flagged on evidence: different numbers across site, landing page and BBB, plus CallRail cookie text); which Hall runs day-to-day calls; the other 17+ DFW advertisers' real addresses.
- Three changes that would most improve the next run: (1) go Maps-first: Maps listed about 20 Arlington roofers, but the keyword Ad Library search surfaced only 2 of them, so check each Maps roofer by name in the Ad Library instead of searching keywords; (2) query the Texas Comptroller through its API or an interactive session to get registry names for HIGH confidence; (3) read each company's header phone and Google place-page owner replies for every row.
- Independence: this run was done by the same session that designed the prompt. Treat the results as a data point for the engine, not as a blind benchmark.
