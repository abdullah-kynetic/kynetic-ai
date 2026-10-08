# Demo business: model business and our demo skin

Prepared Oct 8, 2026. Approach: model a real, well-run local roofer so the demo feels real, but do not clone it. We use public facts (services, materials, area type, warranty style, review themes), not copied website text, logos, photos or a street address. The demo identity is fictional (D-015).

## Model business: AM-1 Roofing, Bend, Oregon (Central Oregon)
Facts below come from search result summaries. The source sites are blocked from this environment, so I could not open them. Verify before using any of it in a pitch.

- Family owned and operated, serving Central Oregon since 1993 ([CertainTeed profile](https://www.certainteed.com/profiles/AM-1Roofing)).
- Residential first, later added commercial roofing, siding, gutters and sheet metal ([profile](https://projectmapit.com/am-1-roofing-inc)).
- Materials: asphalt shingle, metal, synthetic, tile, wood. Flat roofs: TPO, PVC, asphalt systems, coatings.
- CertainTeed Shingle Master Applicator, which allows extended manufacturer warranties. A directory lists a lifetime warranty.
- Active Oregon contractor license (CCB lookup shows valid through Nov 2027) ([CCB lookup](https://www.ccblookup.com/contractor/am-1-roofing-108796/)). Oregon HARP approved contractor (wildfire recovery).
- Rating about 4.8 of 5 on CertainTeed; review counts differ between pages (one shows 4.85 from 18).
- Not confirmed: free estimates, whether they run Meta lead ads, whether they have a front desk.

Other Central Oregon roofers seen (not chosen): Deschutes Roofing (family and veteran owned, 4.6 on Porch, 10 year workmanship guarantee), Greenlee Roofing (family owned, since 1993), 541 Roofing & Heat Coil (veteran owned, GAF listing 4.9 from 92 reviews), Aschoff Advanced Roofing (owner operator, thin listing).

## Cautions before pitching the model business
1. **Owner gate (D-002).** A 30 year company with commercial, siding and sheet metal lines probably has office staff. Check for a front desk before calling; if one answers, it is "not a fit".
2. **No meta ad proof.** I could not check the Meta Ad Library from here. Before pitching any business, confirm it is actually running lead ads.
3. **Never impersonate.** The demo agent introduces itself as calling for the demo company. On a pitch call to a real business, the agent says it is Kynetic AI's demo and may use the prospect's public details only after the owner has agreed to the demo call. No calls to anyone but a tester or the consenting owner (D-007).
4. **Time zone.** The model business is in Pacific time. The generic demo skin uses Central (Dallas test market). A prospect skin needs its own timezone variable.

## Demo skin: Summit Ridge Roofing (fictional, D-015)
Used for the generic pitch and all testing. Replace these facts per client.

| Field | Value |
|---|---|
| Company | Summit Ridge Roofing (fictional; check no real business uses the name before any public use) |
| Agent | Alex, an AI assistant |
| Market | Dallas Fort Worth, Texas (America/Chicago) |
| Services | Residential roof repair, replacement, storm and hail damage inspection |
| Materials | Asphalt shingle, metal, tile |
| Offer | Free 30 minute roof inspection at the property, written estimate after |
| Warranty | Manufacturer warranties available on qualifying installs; the inspector explains |
| Insurance | Insured |
| Calendar | Cal.com "Roof Inspection", event type 7404470, attendee address |
| Lead sources | Meta lead form (stand in: n8n form) |

A "Kynetic AI Roofing" rename for the sales pitch is just a change of `company_name` (and the agent greeting); the prompt does not need rewriting.

## What we borrowed from the model
Services and materials mix, warranty framing (manufacturer backed), the trust signals that matter to homeowners (long operating history, local, licensed), and the free assessment offer. Nothing copied word for word.
