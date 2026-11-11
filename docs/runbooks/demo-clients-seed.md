# Demo clients seed

This runbook loads or removes only the 13 allow-listed demo client workspaces and the synthetic
`demo-kynetic-agency` workspace. It writes directly with the seed role and never queues outbound
work. Run it only with `OUTBOUND_ENABLED=false` and `PROVIDER_MODE=stub`.

## 1. Back up

Before seeding, take and verify the normal production database backup. Record its path and checksum.
Do not continue unless the backup can be listed with `pg_restore --list`.

## 2. Dry run

Replace `<tag>` with the image tag selected for the deploy.

```sh
docker run --rm --network portal-new_default --env-file /opt/portal-new/runtime.env --entrypoint sh kynetic-portal-tools:<tag> -c 'cd /app && DATABASE_URL_SEED="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB" bun run db:seed:demo-clients --dry-run'
```

Review every row. Only the 13 documented slugs and `demo-kynetic-agency` may be planned. A workspace
with a non-`@example.test` member or a status other than `onboarding` must be reported as skipped.

## 3. Seed

```sh
docker run --rm --network portal-new_default --env-file /opt/portal-new/runtime.env --entrypoint sh kynetic-portal-tools:<tag> -c 'cd /app && DATABASE_URL_SEED="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB" bun run db:seed:demo-clients'
```

The first successful run stores its America/Chicago anchor date. Later runs reuse that date and
insert zero rows. Use `--only <slug>`, `--anchor YYYY-MM-DD`, or `--no-agency` only when explicitly
required.

## 4. Verify

Run these read-only checks in `psql`:

```sql
select t.slug, count(*) as ledger_rows
from demo_seed_records d join tenants t on t.id=d.tenant_id
where d.seed_batch='demo-clients-v1'
group by t.slug order by t.slug;

select t.slug, tm.module_key, tm.level
from tenants t join tenant_modules tm on tm.tenant_id=t.id
where t.slug in ('super-roofer','dr-roofing-construction','fairclaims-roofing',
  'fortbend-roofing-texas','rodriguez-roofing','bluewater-pools',
  'tidal-wave-custom-pools','kelley-pools-outdoor','clarity-windows-doors',
  'bridgewood-windows-doors','kitchens-alive','manta-construction','123-remodeling')
and tm.enabled and tm.module_key in ('crm','opm') order by t.slug,tm.module_key;

select t.slug, count(*) filter (where c.provider <> 'fake') as unsafe_calls,
  count(*) as calls
from tenants t left join calls c on c.tenant_id=t.id
where exists (select 1 from demo_seed_records d where d.tenant_id=t.id)
group by t.slug order by t.slug;

select t.slug, count(*) as metric_days, sum(m.leads) as leads, sum(m.booked) as booked
from tenants t join metrics_daily m on m.tenant_id=t.id
where exists (select 1 from demo_seed_records d where d.tenant_id=t.id)
group by t.slug order by t.slug;
```

Every unsafe call count must be zero. View several accounts through admin view-as and confirm the
dashboard, contacts, pipeline, activity, reports, support, presence, and reviews render.

## 5. Remove seeded data

Dry-run removal first, then remove. The remover deletes only ledgered rows, children first, and
restores recorded pre-seed values.

```sh
docker run --rm --network portal-new_default --env-file /opt/portal-new/runtime.env --entrypoint sh kynetic-portal-tools:<tag> -c 'cd /app && DATABASE_URL_SEED="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB" bun run db:remove:demo-clients --dry-run'
docker run --rm --network portal-new_default --env-file /opt/portal-new/runtime.env --entrypoint sh kynetic-portal-tools:<tag> -c 'cd /app && DATABASE_URL_SEED="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB" bun run db:remove:demo-clients'
```

After removal, `demo_seed_records` must contain no `demo-clients-v1` rows. Public company facts and
the original real review snapshots must remain unchanged.
