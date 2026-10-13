# Demo business: Kynetic Roofing, built on AM-1 Roofing's profile

Updated Oct 8, 2026 (D-016, amended later the same day). Abdullah chose option B: the demo business is **Kynetic Roofing**, built on the real profile of AM-1 Roofing Inc (Bend, Oregon), a close friend's company he expects to demo for and possibly sign. **Everything is copied; only the name changes.** Spoken name "Kynetic Roofing" is confirmed. The earlier rule that kept AM-1's contact details, license, ratings and certifications off the demo is withdrawn (see "Amendment" below). The full profile also lives in the Twenty note "BUSINESS PROFILE: Kynetic Roofing (Demo)" (attached to the company and the client account).

Research sources: two independent LLM research runs with live web access (Abdullah ran them), merged below, plus my earlier search-summary pass. Where they disagreed it says so. Contact details (address, phone, emails) are on the Twenty records and in the Twenty profile note.

## Merged findings: AM-1 Roofing Inc

| Item | Finding | Confidence |
|---|---|---|
| Website | am1roofing.com (both runs agree) | high |
| Legal name, license | AM 1 Roofing Inc, Bend, Oregon. Oregon CCB #108796, active through Nov 9, 2027 | high |
| Owners | Thomas and Jennifer Hunziker; started 1993, incorporated 1995 per the site; Thomas Hunziker is the responsible managing individual | high |
| Hours (company's own site) | Monday to Friday 8 AM to 5 PM, weekends closed. Some directories show 7 AM. Use 8 to 5 | high |
| Services | Steep slope roofing (asphalt shingle, metal, synthetic, tile, wood), low slope (asphalt, coatings, metal, PVC, TPO), roof repair, sheet metal fabrication (since 2006), siding, gutters, steel buildings (AM-1 Steel), roof diagnostics | high |
| Service area | "Central Oregon and surrounding areas". Steel buildings page names Bend, Prineville, Redmond, La Pine, Sisters. Roofing page names Bend, Broken Top, Awbrey Butte, Black Butte Ranch, Sunriver, Pronghorn. No complete roofing town list | medium |
| Warranty | CertainTeed Shingle Master Applicator (ShingleMaster Premier per CertainTeed). Site says "warranty for as long as you own your home" on certain shingle installs; 20 year warranty on GE Enduris silicone coatings. GAF GoldElite Commercial Contractor | high |
| Google rating | CONFLICT: 4.5 from 80 (CCB snapshot, Sept), 4.6 from 88 (run 1), 4.9 from about 80 (run 2); Birdeye shows 99 reviews; CertainTeed 4.8 from 18 to 19. Treat as roughly 4.5 to 4.9 from 80 to 99. Verify on Google | low |
| Review themes (both runs agree) | Workmanship quality, professional and responsive communication, fast completion, clean job sites, fair straightforward pricing. A few older complaints about phone interaction and scheduling | medium high |
| Facebook page | CONFLICT: run 1 says the site links to facebook.com/Am1Roofing; run 2 could not find an active page. Verify | low |
| Meta lead ads | NOT VERIFIED by either run (Ad Library blocked) | none |
| Free estimate / free inspection | NOT VERIFIED. They offer estimates and routine inspections; the site does not say "free". A directory says free estimate "No" (old) | none |
| Financing | Not verified. A customer review mentions arranged financing; no program or terms on the site | low |
| Contact form | Fields: name, email, phone, preferred contact method, job address, question. Does not say who answers. Main phone is an office line | medium |
| Public emails | Thomas@ and (run 2 only) Olivia@ at their domain, from directory listings | medium |
| FAQ | No roofing FAQ page. The steel buildings site has one (not relevant to roofing) | high |

## What this means for pitching AM-1
- **Do not claim facts we could not verify.** Say "I couldn't find X on your site", never "you don't offer X". The gaps we can truthfully point to: no booking calendar, no instant quote tool, no financing terms, contact form does not say who responds, no stated response time.
- **Owner gate (D-002):** not yet gated. It is a 30 year company with an office line and a contact form; no evidence the main number or form reaches an owner. Thomas Hunziker is the named owner. A different number (541) listed for a hiring ad is not a sales line; do not use it for outreach.
- **No calls** to AM-1 until the owner gate is checked and an owner has agreed to a demo (D-007).

## Demo identity: Kynetic Roofing
| Field | Value |
|---|---|
| Company | Kynetic Roofing (our demo brand). Spoken name in the agent is the `company_name` variable |
| Agent | Alex, an AI assistant |
| Market | Bend and Central Oregon (America/Los_Angeles) |
| Services (same as AM-1) | Roof repair and replacement; asphalt, metal, synthetic, tile, wood; flat roof systems; also siding, gutters, sheet metal |
| Hours (same as AM-1) | Monday to Friday, 8 to 5 |
| Offer (the thing being tested) | Free 30 minute roof inspection at the property, written estimate after |
| Warranty line | Generic: "manufacturer warranties available on qualifying installs". NOT AM-1's CertainTeed status, license number, or "lifetime" claim |
| Calendar | Cal.com "Roof Inspection", event type 7404470, attendee address, Pacific time |
| Lead source | n8n web form standing in for the Meta lead form (FORM_SPEC.md) |

### Amendment (Oct 8, 2026, later): copy everything
Abdullah decided to copy the real business's information onto the demo so it reads as a real business with only the name changed. It is a close friend's company and he expects to demo for it and possibly sign it, so the data would be needed anyway. Now on the Kynetic Roofing (Demo) company record in Twenty: phone (541) 388-3621, address 52 SE 9th St, Bend OR 97702, Google rating 4.6 from 88 reviews. In the Twenty profile note: website, emails, owners, start year, CCB license, CertainTeed and GAF certifications, warranty wording. The website field is empty on the demo company because Twenty refuses the same domain on two companies.

### Guardrails that remain
1. **Alex's spoken warranty line stays generic** ("manufacturer warranties available on qualifying installs") unless Abdullah says to name the CertainTeed warranty.
2. **Never dial the AM-1 office number** from the demo or any test. Any call to AM-1 needs the owner's OK first. The owner gate (D-002) is not formally checked; Abdullah knows the owner personally.
3. **Unverified items are never stated as fact** in a pitch: Meta lead ads, free estimate, financing, Facebook page, exact rating (4.5 to 4.9 from 80 to 99; 4.6 from 88 is stored).
4. **Free inspection** is the offer under test, not a claim that AM-1 offers one.
5. Test calls go only to numbers the tester owns, with consent.

## Cautions
- Rating, Facebook page and free-estimate status are unverified or conflicting. Check on Google and Facebook before using in any pitch.
- Services and hours come from the company's own site and are reliable. Everything else is directory level.
