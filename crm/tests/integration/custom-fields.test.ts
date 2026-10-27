import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { createContact, getContact, searchContacts, updateContact } from '@/server/contacts';
import {
  createFieldDef,
  deleteFieldDef,
  listFieldDefs,
  reorderFieldDefs,
  updateFieldDef,
  type CreateFieldDefInput
} from '@/server/custom-fields';
import { ValidationError } from '@/server/errors';
import { ModuleDisabledError } from '@/server/modules';
import { stopJobs } from '@/server/jobs';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  // Tenant A is on CRM Full. Tenant B is on CRM Lite.
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'crm', true, 'full'), (${IDS.tenantB}, 'crm', true, 'lite')`;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const roofType = {
  entity: 'contact',
  key: 'roof_type',
  label: 'Roof type',
  type: 'select',
  options: ['Tile', 'Shingle', 'Metal'],
  showInTable: true,
  filterable: true
} satisfies CreateFieldDefInput;

describe('M1-06 custom fields service (F-12)', () => {
  it('creates, lists in order, updates, reorders and audits definitions', async () => {
    const def = await createFieldDef(ctx.ownerA(), roofType, opts);
    expect(def).toMatchObject({
      key: 'roof_type',
      type: 'select',
      showInTable: true,
      filterable: true
    });
    const budget = await createFieldDef(
      ctx.ownerA(),
      { entity: 'contact', key: 'budget', label: 'Budget', type: 'money', filterable: true },
      opts
    );
    expect(budget.position).toBeGreaterThan(def.position);

    const updated = await updateFieldDef(
      ctx.ownerA(),
      def.id,
      { label: 'Roof material', options: ['Tile', 'Shingle', 'Metal', 'Slate'] },
      opts
    );
    expect(updated.label).toBe('Roof material');
    expect(updated.options).toHaveLength(4);

    // The seed already defines roof_age for every tenant, so a reorder lists all three.
    const all = await listFieldDefs(ctx.ownerA(), 'contact', opts);
    const ids = [
      budget.id,
      def.id,
      ...all.map((d) => d.id).filter((i) => i !== budget.id && i !== def.id)
    ];
    const reordered = await reorderFieldDefs(ctx.ownerA(), { entity: 'contact', ids }, opts);
    expect(reordered.slice(0, 2).map((d) => d.key)).toEqual(['budget', 'roof_type']);
    await expect(
      reorderFieldDefs(ctx.ownerA(), { entity: 'contact', ids: [budget.id] }, opts)
    ).rejects.toBeInstanceOf(ValidationError);

    const actions = await tdb.admin`select action from audit_log where entity = 'custom_field_def'`;
    expect(actions.map((a) => a.action)).toEqual(
      expect.arrayContaining(['custom_field.create', 'custom_field.update', 'custom_field.reorder'])
    );
  });

  it('refuses a repeated key, a bad key, and changes to type or key', async () => {
    await expect(createFieldDef(ctx.ownerA(), roofType, opts)).rejects.toMatchObject({
      fieldErrors: { key: ['key_in_use'] }
    });
    await expect(
      createFieldDef(ctx.ownerA(), { ...roofType, key: 'Bad Key' }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    const [d] = await listFieldDefs(ctx.ownerA(), 'contact', opts);
    await expect(
      updateFieldDef(ctx.ownerA(), d.id, { type: 'text' } as never, opts)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('F-12 isolation: tenant B never sees tenant A definitions (API and SQL)', async () => {
    await tdb.admin`insert into custom_field_defs (tenant_id, entity, key, label, type)
      values (${IDS.tenantB}, 'contact', 'b_only', 'B only', 'text')`;
    // SQL as the app role, with tenant B's context and then with none.
    const asB = await createDb(tdb.app).transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${IDS.tenantB}, true)`);
      return tx.execute<{ key: string }>(sql`select key from custom_field_defs`);
    });
    expect([...asB].map((r) => r.key)).not.toContain('roof_type');
    const none = await tdb.app`select key from custom_field_defs`;
    expect(none).toHaveLength(0);
    const fromA = await listFieldDefs(ctx.ownerA(), undefined, opts);
    expect(fromA.map((d) => d.key)).toEqual(expect.arrayContaining(['roof_type', 'budget']));
    expect(fromA.some((d) => d.key === 'b_only')).toBe(false);
  });

  it('F-85: a Lite tenant gets 403 on every call and nothing is written', async () => {
    const before =
      await tdb.admin`select count(*)::int as n from custom_field_defs where tenant_id = ${IDS.tenantB}`;
    for (const call of [
      () => listFieldDefs(ctx.ownerB(), undefined, opts),
      () =>
        createFieldDef(
          ctx.ownerB(),
          { entity: 'contact', key: 'nope', label: 'Nope', type: 'text' },
          opts
        ),
      () => updateFieldDef(ctx.ownerB(), crypto.randomUUID(), { label: 'x' }, opts),
      () => deleteFieldDef(ctx.ownerB(), crypto.randomUUID(), opts),
      () =>
        createContact(
          ctx.ownerB(),
          { firstName: 'Lite', phones: ['415-555-0188'], custom: { roof_age: 4 } },
          opts
        )
    ]) {
      const err = await call().then(
        () => null,
        (e: unknown) => e
      );
      expect(err).toBeInstanceOf(ModuleDisabledError);
      expect((err as ModuleDisabledError).status).toBe(403);
    }
    const after =
      await tdb.admin`select count(*)::int as n from custom_field_defs where tenant_id = ${IDS.tenantB}`;
    expect(after[0].n).toBe(before[0].n);
  });

  it('only owners and admins edit definitions; staff may not', async () => {
    await expect(
      createFieldDef(
        ctx.staffA(),
        { entity: 'contact', key: 'staff_try', label: 'x', type: 'text' },
        opts
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      createFieldDef(
        ctx.adminViewingA(),
        {
          entity: 'contact',
          key: 'admin_ok',
          label: 'Admin field',
          type: 'checkbox',
          filterable: true
        },
        opts
      )
    ).resolves.toMatchObject({ key: 'admin_ok' });
  });

  it('F-12: contacts validate custom values by type and reject unknown keys', async () => {
    const ok = await createContact(
      ctx.ownerA(),
      {
        firstName: 'Ana',
        phones: ['415-555-0111'],
        custom: { roof_type: 'Tile', budget: 450000, admin_ok: true }
      },
      opts
    );
    expect(ok.custom).toEqual({ roof_type: 'Tile', budget: 450000, admin_ok: true });

    for (const custom of [
      { roof_type: 'Thatch' },
      { budget: 12.5 },
      { admin_ok: 'yes' },
      { surprise: 1 },
      // roof_age exists only for the fixture's contact definitions in the seed, not as a typed number here
      { roof_age: 'old' }
    ]) {
      await expect(
        createContact(ctx.ownerA(), { firstName: 'Bad', phones: ['415-555-0112'], custom }, opts)
      ).rejects.toBeInstanceOf(ValidationError);
    }
    const upd = await updateContact(ctx.ownerA(), ok.id, { custom: { roof_type: 'Metal' } }, opts);
    expect(upd.custom).toEqual({ roof_type: 'Metal' });
    await expect(
      updateContact(ctx.ownerA(), ok.id, { custom: { roof_type: 'Nope' } }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await getContact(ctx.ownerA(), ok.id, opts)).custom).toEqual({ roof_type: 'Metal' });
  });

  it('F-12: filters the leads list by a custom select, text, number, money, date and checkbox', async () => {
    await createFieldDef(
      ctx.ownerA(),
      {
        entity: 'contact',
        key: 'extras',
        label: 'Extras',
        type: 'multi_select',
        options: ['Gutters', 'Solar'],
        filterable: true
      },
      opts
    );
    for (const [i, f] of (
      [
        ['Tile', { roof_type: 'Tile', extras: ['Solar'], budget: 100000, admin_ok: true }],
        ['Metal', { roof_type: 'Metal', extras: ['Gutters', 'Solar'], budget: 200000 }],
        ['Shingle', { roof_type: 'Shingle' }]
      ] as const
    ).entries()) {
      await createContact(
        ctx.ownerA(),
        { firstName: `Filter ${f[0]}`, phones: [`415-555-02${i}0`], custom: f[1] },
        opts
      );
    }
    const names = async (custom: Record<string, unknown>) =>
      (await searchContacts(ctx.ownerA(), { q: 'Filter', custom } as never, opts)).rows
        .map((r) => r.firstName)
        .toSorted();

    expect(await names({ roof_type: { any: ['Tile', 'Metal'] } })).toEqual([
      'Filter Metal',
      'Filter Tile'
    ]);
    expect(await names({ extras: { any: ['Solar'] } })).toEqual(['Filter Metal', 'Filter Tile']);
    expect(await names({ extras: { any: ['Gutters'] } })).toEqual(['Filter Metal']);
    expect(await names({ budget: { eq: 200000 } })).toEqual(['Filter Metal']);
    expect(await names({ admin_ok: { any: ['true'] } })).toEqual(['Filter Tile']);
    // Unticked includes records that never set the box.
    expect(await names({ admin_ok: { any: ['false'] } })).toEqual([
      'Filter Metal',
      'Filter Shingle'
    ]);

    // The list returns custom values for the table columns.
    const rows = (await searchContacts(ctx.ownerA(), { q: 'Filter Tile' }, opts)).rows;
    expect(rows[0].custom).toMatchObject({ roof_type: 'Tile' });

    // A field not marked filterable, an unknown key and a wrong shape are refused.
    await expect(names({ budget: { contains: 'x' } })).rejects.toBeInstanceOf(ValidationError);
    await expect(names({ nope: { any: ['x'] } })).rejects.toBeInstanceOf(ValidationError);
    await expect(names({ budget: { eq: 1 } })).resolves.toEqual([]);
  });

  it('F-12: a Lite tenant cannot filter by custom fields', async () => {
    await expect(
      searchContacts(ctx.ownerB(), { custom: { roof_type: { any: ['Tile'] } } } as never, opts)
    ).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it('deleting a definition strips its values from the entity rows and audits', async () => {
    const [extras] = (await listFieldDefs(ctx.ownerA(), 'contact', opts)).filter(
      (d) => d.key === 'extras'
    );
    await deleteFieldDef(ctx.ownerA(), extras.id, opts);
    const left =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA} and custom ? 'extras'`;
    expect(left[0].n).toBe(0);
    const keep =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA} and custom ? 'roof_type'`;
    expect(keep[0].n).toBeGreaterThan(0);
    const [a] = await tdb.admin`select action from audit_log where action = 'custom_field.delete'`;
    expect(a).toBeDefined();
    // The key is free again and starts clean.
    await expect(
      createFieldDef(
        ctx.ownerA(),
        { entity: 'contact', key: 'extras', label: 'Extras', type: 'text' },
        opts
      )
    ).resolves.toMatchObject({ type: 'text' });
  });
});
