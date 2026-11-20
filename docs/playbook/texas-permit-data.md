# Texas permit data for "permit watch" (checked 2026-11-20)

Status: research note. Nothing is built. Targets (Houston, Dallas, San Antonio, Austin) are Abdullah's stated plan on 2026-11-20, not an approved decision. The ICP (`icp.md`) says any US state except Florida and Oklahoma.

Texas has no statewide permit database or statewide building code. Each city (or county outside city limits) issues and publishes its own permits. Rural, unincorporated jobs often leave no permit record.

Each endpoint below was queried on 2026-11-20 from the cloud container with no key.

| City | Official source | Per-permit rows | Contractor field | Freshness |
|---|---|---|---|---|
| Austin | data.austintexas.gov, dataset `3syk-w9eu` "Issued Construction Permits" (Socrata API) | Yes | Yes: `contractor_company_name`, `contractor_phone`, `contractor_trade`; also valuation, remodel sq ft, issue date | Rows updated 2026-11-19 |
| Dallas | dallasopendata.com, dataset `e7gq-4sah` "Building Permits" (Socrata API) | Yes | Yes: `contractor`, plus `value`, `permit_type`, `work_description`, `street_address`, `zip_code` | Updated 2026-11-20. `issued_date` is text (MM/DD/YY), so sort carefully |
| San Antonio | data.sanantonio.gov, dataset "Building Permits" (CKAN, CC-BY): `permits_issued.csv`, 2020-2024 CSV, data dictionary | Yes | No clear contractor field. `PRIMARY CONTACT` holds owner or business names (some are individuals) | Updated 2026-11-15 |
| Houston | data.houstontx.gov "Residential Building Permits" | No. Monthly summary spreadsheet only | No | Last updated 2026-05-01 |

Houston per-permit records are not on the open data portal. Options: the Houston Permitting Center's search and permit activity reports, an open records request, or a paid data provider. Not confirmed here.

## Rules and cautions
- Public records, free to use. Austin's terms of use and San Antonio's CC-BY attribution apply; read them before publishing anything.
- Do not show homeowner or individual names. San Antonio's primary contact can be a homeowner. Report at business and area level.
- A permit is not proof of who won a job. Names are inconsistent and need cleaning. Blank contractor fields are common.
- Using permit data to find contractors to call follows the existing rules: human dials, owner only, no Florida or Oklahoma, no AM-1.
- Aggregate Texas counts (Texas Demographic Center) have no contractor detail.

## Next steps (not started)
1. Pull a 90-day sample for Austin and Dallas, count remodel/addition permits by contractor in one zip, and check how clean the names are.
2. Check San Antonio's data dictionary for a contractor or applicant field.
3. Decide with Abdullah whether Houston is worth an open records request.

Sources: data.austintexas.gov/api/views/3syk-w9eu, dallasopendata.com (Socrata catalog, dataset e7gq-4sah), data.sanantonio.gov (CKAN package building-permits), data.houstontx.gov (package residential-building-permits).
