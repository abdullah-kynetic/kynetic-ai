import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAgencyProspect,
  deriveProspectStage,
  getProspectFunnel,
  listAgencyProspects,
  moveProspectsToSales
} from '@/server/agency/prospects';
import { listAgencyLeads } from '@/server/agency';
import { agencyAdmin, setupAgency } from '../helpers/agency';
import type { Db } from '@/server/db/client';

let agency: Awaited<ReturnType<typeof setupAgency>>;
let db: Db;
const ids: Record<string, string> = {};

beforeAll(async () => {
  agency = await setupAgency();
  db = agency.db;
});
afterAll(async () => {
  await agency?.close();
});

const make = (input: Record<string, unknown>) =>
  createAgencyProspect(agencyAdmin, { source: 'google_maps', ...input }, { db });

describe('agency prospects funnel', () => {
  it('derives the enrichment stage from the fields that are filled in', () => {
    expect(deriveProspectStage({})).toBe('scraped');
    expect(deriveProspectStage({ website: 'https://a.example.test' })).toBe('half_enriched');
    expect(
      deriveProspectStage({
        website: 'x',
        phone: '+12025550123',
        email: 'a@example.test',
        ownerName: 'Owner'
      })
    ).toBe('fully_enriched');
  });

  it('starts with an empty funnel and an empty list', async () => {
    const funnel = await getProspectFunnel(agencyAdmin, { db });
    expect(funnel.total).toBe(0);
    expect(funnel.steps.map((s) => s.conversion)).toEqual([null, null, null, null]);
    expect(await listAgencyProspects(agencyAdmin, {}, { db })).toEqual([]);
  });

  it('stores prospects at each stage and counts them, with conversion and sources', async () => {
    ids.scrapedA = (await make({ businessName: 'Scraped One', city: 'Austin', state: 'TX' })).id;
    await make({ businessName: 'Scraped Two', source: 'directory' });
    ids.half = (await make({ businessName: 'Half One', phone: '+12025550123' })).id;
    ids.full = (
      await make({
        businessName: 'Full One',
        website: 'https://full.example.test',
        phone: '+12025550124',
        email: 'full-one@example.test',
        ownerName: 'Pat Owner',
        state: 'TX'
      })
    ).id;
    ids.full2 = (
      await make({
        businessName: 'Full Two',
        website: 'https://full2.example.test',
        phone: '+12025550125',
        email: 'full-two@example.test',
        ownerName: 'Sam Owner',
        source: 'referral'
      })
    ).id;
    const funnel = await getProspectFunnel(agencyAdmin, { db });
    expect([
      funnel.scraped,
      funnel.halfEnriched,
      funnel.fullyEnriched,
      funnel.movedToSales
    ]).toEqual([2, 1, 2, 0]);
    expect(funnel.total).toBe(5);
    expect(funnel.steps[1]).toMatchObject({ reached: 3, conversion: 3 / 5 });
    expect(funnel.steps[2]).toMatchObject({ reached: 2, conversion: 2 / 3 });
    expect(Object.fromEntries(funnel.sources.map((s) => [s.source, s.count]))).toEqual({
      google_maps: 3,
      directory: 1,
      referral: 1
    });
  });

  it('filters by stage, search, source and state', async () => {
    const names = async (f: object) =>
      (await listAgencyProspects(agencyAdmin, f, { db })).map((p) => p.businessName).sort();
    expect(await names({ stage: 'fully_enriched' })).toEqual(['Full One', 'Full Two']);
    expect(await names({ q: 'one' })).toEqual(['Full One', 'Half One', 'Scraped One']);
    expect(await names({ source: 'directory' })).toEqual(['Scraped Two']);
    expect(await names({ state: 'tx' })).toEqual(['Full One', 'Scraped One']);
  });

  it('rejects real-looking contact data and unsupported states', async () => {
    await expect(make({ businessName: 'Real', email: 'owner@gmail.com' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    await expect(make({ businessName: 'Florida', state: 'FL' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
  });

  it('moves selected prospects to Sales as deals, DB only, and skips the rest', async () => {
    const before = await agency.test.admin`select
      (select count(*)::int from agency_call_attempts) calls,
      (select count(*)::int from agency_message_drafts) drafts,
      (select count(*)::int from agency_dm_logs) dms`;
    const result = await moveProspectsToSales(agencyAdmin, [ids.full!, ids.scrapedA!, ids.full2!], {
      db
    });
    expect(result.moved.map((m) => m.prospectId).sort()).toEqual([ids.full, ids.full2].sort());
    expect(result.skipped).toEqual([
      expect.objectContaining({ prospectId: ids.scrapedA, reason: 'Needs an email first.' })
    ]);
    const { leads } = await listAgencyLeads(agencyAdmin, {}, { db });
    expect(leads.map((l) => l.firstName)).toEqual(expect.arrayContaining(['Full One', 'Full Two']));
    const after = await agency.test.admin`select
      (select count(*)::int from agency_call_attempts) calls,
      (select count(*)::int from agency_message_drafts) drafts,
      (select count(*)::int from agency_dm_logs) dms`;
    expect(after[0]).toEqual(before[0]);
    const audits = await agency.test
      .admin`select action from audit_log where action = 'prospect.move_to_sales'`;
    expect(audits).toHaveLength(2);
    const funnel = await getProspectFunnel(agencyAdmin, { db });
    expect(funnel.movedToSales).toBe(2);
    expect(funnel.fullyEnriched).toBe(0);
    expect(funnel.steps[3]).toMatchObject({ reached: 2, conversion: 1 });
    expect(
      (await listAgencyProspects(agencyAdmin, { stage: 'fully_enriched' }, { db })).length
    ).toBe(0);
  });

  it('does not create a second deal when a prospect is moved twice', async () => {
    const again = await moveProspectsToSales(agencyAdmin, [ids.full!], { db });
    expect(again.moved).toEqual([]);
    expect(again.skipped[0]).toMatchObject({ reason: 'Already in Sales.' });
    const rows = await agency.test
      .admin`select count(*)::int n from deals where title = 'Full One'`;
    expect(rows[0]!.n).toBe(1);
  });
});

describe('agency prospects do-not-call guard', () => {
  it('does not move a prospect whose phone is on the active do-not-call list', async () => {
    const dncProspect = await make({
      businessName: 'Dnc Co',
      email: 'dnc@example.test',
      phone: '+12025550103'
    });
    await agency.test.admin`insert into dnc_entries (tenant_id, e164, source)
      values (${agency.tenantId}, '+12025550103', 'test')`;
    const result = await moveProspectsToSales(agencyAdmin, [dncProspect.id], { db });
    expect(result.moved).toEqual([]);
    expect(result.skipped).toEqual([
      expect.objectContaining({ prospectId: dncProspect.id, reason: 'On the do-not-call list.' })
    ]);
    const deals = await agency.test.admin`select count(*)::int n from deals where title = 'Dnc Co'`;
    expect(deals[0]!.n).toBe(0);
  });

  it('moves a prospect again once its do-not-call entry is removed', async () => {
    const p = await make({
      businessName: 'Lifted Co',
      email: 'lifted@example.test',
      phone: '+12025550104'
    });
    await agency.test.admin`insert into dnc_entries (tenant_id, e164, source, removed_at)
      values (${agency.tenantId}, '+12025550104', 'test', now())`;
    const result = await moveProspectsToSales(agencyAdmin, [p.id], { db });
    expect(result.moved.map((m) => m.prospectId)).toEqual([p.id]);
  });
});
