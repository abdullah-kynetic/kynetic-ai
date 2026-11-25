# Live steps for the AA shop track

Nothing here has been run. Each step changes a live system and needs an explicit yes on that step. Run them in order. Stop at the first failure and do not continue.

Target tenant: `aa-auto-body-shop`. Live portal today: `5e2bb4a52310df9f424846e78cd7e4eed06c268e`. The only migration in this track is `1097` (adds the `shop_ops` row to `module_catalog`, idempotent). Check no other migration is pending against live before step 2.

## 1. Check pending migrations against live (read-only)

Compare the migration journal on `main` against the live `drizzle` migrations table. Expected: `1097` is the only pending one. If anything else is pending, stop and tell Abdullah.

## 2. Pre-deploy dump (live system, VPS)

Run on the VPS inside the postgres container, with a timestamped file name:
`/var/backups/portal-new-pre-deploy-<shortsha>-<UTC timestamp>.dump`
Confirm the file exists and is non-empty before continuing.

## 3. Deploy `main` (live system, VPS)

From a WSL checkout at the merged `main` commit (use the full SHA):

```
git archive <FULL sha>:crm | ssh kynetic-vps "sudo /usr/local/sbin/portal-new-deploy deploy <FULL sha>"
```

Then verify `https://portal.kyneticai.com/api/health` returns 200. Roll back only on a deploy or health failure, using the dump from step 2.

## 4. Turn the module on for the shop (live data)

MCP `set_client_module`: client `aa-auto-body-shop`, module `shop_ops`, enabled `true`.

## 5. Apply the Auto body template (live data)

MCP `apply_industry_template`: client `aa-auto-body-shop`, industry `auto_body`. This sets the eight pipeline stages (New lead, Quoted, Waiting on insurance, Parts ordered, In repair and paint, Ready for pickup, Picked up, Lost) and enrolls Quoted in quote follow-up.

## 6. Create the nine auto body deal fields (live data)

The template does not create custom fields, and no app screen does. Create these with MCP `create_custom_field` on `aa-auto-body-shop`, entity `deal`, keys exactly as written (the shop screens read these keys). Skip any that already exist.

| key | label | type | options | notes |
|---|---|---|---|---|
| `vehicle_year` | Vehicle year | number | | show in table |
| `vehicle_make` | Vehicle make | text | | show in table |
| `vehicle_model` | Vehicle model | text | | show in table |
| `payment_type` | Payment type | select | Out-of-pocket, Insurance | show in table, filterable |
| `insurer` | Insurer | text | | filterable |
| `claim_number` | Claim number | text | | |
| `estimate_amount` | Estimate amount | money | | show in table |
| `drop_off_date` | Drop-off date | date | | show in table |
| `tech` | Tech | text | | filterable |

Source of truth: `crm/src/server/shop/custom-fields.ts` (`AUTO_BODY_FIELDS`).

## 7. Load sample data (live data, optional, labeled as sample)

From WSL with `DATABASE_URL_SEED` set for the live database:

```
cd crm
bun run db:seed:shop-demo -- --slug aa-auto-body-shop            # dry run, prints the plan
bun run db:seed:shop-demo -- --slug aa-auto-body-shop --apply    # writes batch aa-shop-demo-v1
```

Every row is tagged `aa-shop-demo-v1` and the shop pages show a "sample data" banner while any exists. Remove it before real use, or before showing real numbers:

```
bun run db:remove:shop-demo -- --slug aa-auto-body-shop          # dry run
bun run db:remove:shop-demo -- --slug aa-auto-body-shop --apply
```

## 8. Final check (read-only)

- `/api/health` returns 200.
- Sign in as the shop client and open every page under Shop (Today, Leads, Calls and texts, Calendar, Jobs, Quotes, Insurance, Team, Report, Money, Customers, Reviews, Get found, Away mode, Connections).
- Outbound flags stay as they are today (stub, off). Nothing in this track sends; do not change them.
