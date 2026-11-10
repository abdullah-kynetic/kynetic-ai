import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { setStorage } from '@/server/adapters/storage';
import { updateAdminAlexConfig } from '@/server/admin/alex-config';
import { agencyAdmin, setupAgency } from '../helpers/agency';
import { createAgencyLead, getAgencyPipeline, moveAgencyDeal } from '@/server/agency';
import { logAgencyCall, getAgencyDialer, markAgencyDnc } from '@/server/agency/dialer';
import { createAgencyCampaign, assignAgencyCampaign } from '@/server/agency/campaigns';
import {
  advanceAgencyCampaign,
  agencyCampaignStats,
  setAgencyCampaignPlan,
  startAgencyCampaign
} from '@/server/agency/campaign-engine';
import { applyAgencyBillingWebhook } from '@/server/agency/billing';
import {
  createAgencyContract,
  listAgencyContracts,
  markAgencyContractSent,
  markAgencyContractSigned,
  voidAgencyContract
} from '@/server/agency/contracts';
import {
  addAgencyExpense,
  addAgencyReferral,
  addAgencyRevenue,
  approveAgencyReferral,
  deleteAgencyExpense,
  getAgencyFinance,
  saveAgencyCaseStudy
} from '@/server/agency/finance';
import {
  deleteTenantDocument,
  getTenantDocumentUrl,
  listTenantDocuments,
  replaceTenantDocument,
  uploadTenantDocument
} from '@/server/documents';
import { commitContactBatch, createImportBatch, dryRunContactBatch } from '@/server/imports';
import type { Actor } from '@/server/auth/permissions';
import { IDS, ctx } from '../helpers/fixtures';
import { buildXlsx, buildZip, sheetWithRows } from '../helpers/xlsx-fixture';

let env: Awaited<ReturnType<typeof setupAgency>>;
const storage = new FakeStorage();
const adminActor: Actor = {
  userId: IDS.admin,
  kyneticRole: 'admin',
  membership: null,
  viewAs: null
};
const ownerA: Actor = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'owner', canExport: true, canBulkDelete: true },
  viewAs: null
};
let seq = 0;
async function coldLead(name: string) {
  seq += 1;
  return createAgencyLead(
    agencyAdmin,
    {
      firstName: name,
      email: `batch4-${seq}@example.test`,
      direction: 'outbound',
      channel: 'cold_call',
      phone: `+120255501${String(seq).padStart(2, '0')}`,
      state: 'CA'
    },
    { db: env.db }
  );
}

beforeAll(async () => {
  env = await setupAgency();
  setStorage(storage);
});
afterAll(async () => {
  setStorage(undefined);
  await env?.close();
});

describe('batch 4 agency sales tools', () => {
  it('schedules a Pacific callback, shows it when due, and refuses DNC', async () => {
    const lead = await coldLead('Callback prospect');
    const before = await env.test.admin`select count(*)::int as n from messages`;
    await logAgencyCall(
      agencyAdmin,
      {
        eventId: crypto.randomUUID(),
        contactId: lead.contactId,
        outcome: 'callback',
        notes: '',
        callbackDate: '2026-07-15',
        callbackTime: '09:30'
      },
      { db: env.db, now: new Date('2026-07-15T15:00:00Z') }
    );
    const waiting = await getAgencyDialer(agencyAdmin, undefined, {
      db: env.db,
      now: new Date('2026-07-15T16:00:00Z')
    });
    expect(waiting.next?.id).not.toBe(lead.contactId);
    const due = await getAgencyDialer(agencyAdmin, undefined, {
      db: env.db,
      now: new Date('2026-07-15T16:30:00Z')
    });
    expect(due.next).toMatchObject({ id: lead.contactId, callbackDue: true });
    const [task] = await env.test.admin`
      select due_at from tasks where contact_id = ${lead.contactId} and title = 'Scheduled callback'`;
    expect(new Date(task!.due_at).toISOString()).toBe('2026-07-15T16:30:00.000Z');
    const audit = await env.test.admin`
      select action from audit_log where action = 'agency.callback.schedule' and tenant_id = ${env.tenantId}`;
    expect(audit.length).toBeGreaterThan(0);
    const blocked = await coldLead('Do not call');
    await markAgencyDnc(agencyAdmin, blocked.contactId, { db: env.db });
    await expect(
      logAgencyCall(
        agencyAdmin,
        {
          eventId: crypto.randomUUID(),
          contactId: blocked.contactId,
          outcome: 'callback',
          notes: '',
          callbackDate: '2026-07-16',
          callbackTime: '10:00'
        },
        { db: env.db }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await env.test.admin`select count(*)::int as n from messages`).toEqual(before);
    expect(
      await env.test.admin`select id from calls where tenant_id = ${env.tenantId}`
    ).toHaveLength(0);
  });

  it('marks a campaign step done, skips, reschedules, and refuses simulate in production', async () => {
    const lead = await createAgencyLead(
      agencyAdmin,
      {
        firstName: 'Sequence prospect',
        email: 'batch4-sequence@example.test',
        direction: 'outbound',
        channel: 'email'
      },
      { db: env.db }
    );
    const campaign = await createAgencyCampaign(
      agencyAdmin,
      { name: 'Batch 4 sequence', script: 'Manual tasks only' },
      { db: env.db }
    );
    await assignAgencyCampaign(agencyAdmin, campaign.id, lead.contactId, { db: env.db });
    const opts = { db: env.db, now: new Date('2026-11-05T18:00:00Z') };
    await setAgencyCampaignPlan(
      agencyAdmin,
      campaign.id,
      [
        { channel: 'call', delayDays: 0, instructions: 'Call them' },
        { channel: 'dm', delayDays: 3, instructions: 'Write a manual note' }
      ],
      opts
    );
    await startAgencyCampaign(agencyAdmin, campaign.id, opts);
    expect(
      await advanceAgencyCampaign(
        agencyAdmin,
        { campaignId: campaign.id, contactId: lead.contactId, stepIndex: 0, mode: 'done' },
        opts
      )
    ).toMatchObject({ status: 'active', providerRequests: 0 });
    expect(
      await advanceAgencyCampaign(
        agencyAdmin,
        {
          campaignId: campaign.id,
          contactId: lead.contactId,
          stepIndex: 1,
          mode: 'reschedule',
          callbackDate: '2026-11-06',
          callbackTime: '09:00'
        },
        opts
      )
    ).toMatchObject({ status: 'active', providerRequests: 0 });
    expect(
      await advanceAgencyCampaign(
        agencyAdmin,
        {
          campaignId: campaign.id,
          contactId: lead.contactId,
          stepIndex: 1,
          mode: 'skip',
          reason: 'No answer on the manual note'
        },
        { ...opts, now: new Date('2026-11-06T17:00:00Z') }
      )
    ).toMatchObject({ status: 'complete', providerRequests: 0 });
    const stats = await agencyCampaignStats(agencyAdmin, campaign.id, opts);
    expect(stats.map((row) => row.result).toSorted()).toEqual(['done', 'rescheduled', 'skipped']);
    const history = await env.test.admin`
      select recorded_by, result from agency_campaign_history where campaign_id = ${campaign.id}`;
    expect(history.every((row) => row.recorded_by === IDS.admin)).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    await expect(
      advanceAgencyCampaign(
        agencyAdmin,
        { campaignId: campaign.id, contactId: lead.contactId, stepIndex: 0, mode: 'simulate' },
        opts
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      applyAgencyBillingWebhook(agencyAdmin, { livemode: false }, opts)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('tracks contracts without sending and hides them from a client tenant', async () => {
    const lead = await coldLead('Contract prospect');
    const created = await createAgencyContract(
      agencyAdmin,
      { dealId: lead.dealId, title: 'Growth agreement' },
      { db: env.db, storage }
    );
    await markAgencyContractSent(
      agencyAdmin,
      { id: created.id, sentOn: '2026-11-02' },
      { db: env.db }
    );
    const pdf = new TextEncoder().encode('%PDF-1.7\nsigned agreement');
    await markAgencyContractSigned(
      agencyAdmin,
      { id: created.id, signedOn: '2026-11-03', notes: 'Signed on paper' },
      { name: 'signed.pdf', body: pdf },
      { db: env.db, storage }
    );
    const listed = await listAgencyContracts(agencyAdmin, { status: 'signed' }, { db: env.db });
    expect(listed.some((row) => row.id === created.id && row.signedFileKey)).toBe(true);
    await voidAgencyContract(agencyAdmin, created.id, { db: env.db });
    expect(
      (await listAgencyContracts(agencyAdmin, { status: 'void' }, { db: env.db })).some(
        (row) => row.id === created.id
      )
    ).toBe(true);
    const hidden = await env.test.app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${IDS.tenantA}, true)`;
      return tx`select id from agency_contracts`;
    });
    expect(hidden).toEqual([]);
    const audits = await env.test.admin`
      select action from audit_log where entity_id = ${created.id} order by action`;
    expect(audits.map((row) => row.action)).toEqual([
      'agency.contract.create',
      'agency.contract.sent',
      'agency.contract.signed',
      'agency.contract.void'
    ]);
  });

  it('records finance rows, a summary, and an admin-only referral approval', async () => {
    const lead = await coldLead('Won prospect');
    const pipeline = await getAgencyPipeline(agencyAdmin, { db: env.db });
    await moveAgencyDeal(
      agencyAdmin,
      lead.dealId,
      pipeline.stages.find((stage) => stage.isWon)!.id,
      {
        db: env.db
      }
    );
    await env.test.admin`update deals set value_cents = 25000 where id = ${lead.dealId}`;
    await addAgencyRevenue(
      agencyAdmin,
      { receivedOn: '2026-11-04', amountCents: 5000, note: 'Manual entry' },
      { db: env.db }
    );
    const expense = await addAgencyExpense(
      agencyAdmin,
      {
        spentOn: '2026-11-04',
        vendor: 'Print shop',
        category: 'materials',
        amountCents: 1200,
        note: ''
      },
      { db: env.db }
    );
    await deleteAgencyExpense(agencyAdmin, expense.id, { db: env.db });
    const referral = await addAgencyReferral(
      agencyAdmin,
      { referrerName: 'Quentin', contactId: lead.contactId, rewardNote: 'Thank-you note' },
      { db: env.db }
    );
    await approveAgencyReferral(agencyAdmin, referral.id, { db: env.db });
    await expect(
      approveAgencyReferral({ id: IDS.va, kyneticRole: 'va' }, referral.id, { db: env.db })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await saveAgencyCaseStudy(
      agencyAdmin,
      { clientTenantId: IDS.tenantA, status: 'idea', url: '', note: 'Story not written yet' },
      { db: env.db }
    );
    const finance = await getAgencyFinance(agencyAdmin, { db: env.db });
    expect(finance.expenses).toHaveLength(0);
    expect(finance.referrals[0]).toMatchObject({ referrerName: 'Quentin', status: 'approved' });
    expect(finance.studies[0]).toMatchObject({ status: 'idea', clientName: expect.any(String) });
    expect(finance.won.some((deal) => deal.cents === 25000)).toBe(true);
    expect(
      await env.test.admin`select id from messages where tenant_id = ${env.tenantId}`
    ).toHaveLength(0);
  });
});

describe('batch 4 documents and imports', () => {
  it('soft-deletes and replaces a PDF without removing the stored object', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\nfirst copy');
    const uploaded = await uploadTenantDocument(
      { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' },
      adminActor,
      { title: 'Proposal', kind: 'proposal', fileName: 'proposal.pdf' },
      pdf,
      { db: env.db, storage }
    );
    const replacement = await replaceTenantDocument(
      { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' },
      adminActor,
      uploaded.id,
      { title: 'Proposal', kind: 'proposal', fileName: 'proposal.pdf' },
      new TextEncoder().encode('%PDF-1.7\nsecond copy'),
      { db: env.db, storage }
    );
    const visible = await listTenantDocuments(ctx.ownerA(), ownerA, { db: env.db });
    expect(visible.map((row) => row.id)).toContain(replacement.id);
    expect(visible.map((row) => row.id)).not.toContain(uploaded.id);
    await expect(
      getTenantDocumentUrl(ctx.ownerA(), ownerA, uploaded.id, { db: env.db, storage })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(storage.get(`${IDS.tenantA}/documents/${uploaded.id}/document.pdf`)).toBeTruthy();
    await deleteTenantDocument(
      { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' },
      adminActor,
      replacement.id,
      { db: env.db }
    );
    expect(await listTenantDocuments(ctx.ownerA(), ownerA, { db: env.db })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: replacement.id })])
    );
    const actions = await env.test.admin`
      select action from audit_log where tenant_id = ${IDS.tenantA} and action in ('document.delete','document.replace')`;
    expect(actions.map((row) => row.action).toSorted()).toEqual([
      'document.delete',
      'document.replace'
    ]);
  });

  it('imports a safe xlsx and refuses a zip bomb and a renamed macro file', async () => {
    const adminCtx = { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' as const };
    const formula = buildXlsx(
      `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>first</t></is></c><c r="B1" t="inlineStr"><is><t>phone</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>Ada</t></is></c><c r="B2" t="str"><f>1+1</f></c></row>
</sheetData></worksheet>`
    );
    const formulaBatch = await createImportBatch(
      adminCtx,
      adminActor,
      { fileName: 'formula.xlsx', fileType: 'xlsx', importedSource: 'csv_other' },
      formula,
      { db: env.db }
    );
    const report = await dryRunContactBatch(
      adminCtx,
      adminActor,
      formulaBatch.id,
      { firstName: 'first', phone: 'phone' },
      { db: env.db }
    );
    expect(report.issues[0]?.reason).toMatch(/formula_not_cached/);
    const valid = buildXlsx(
      sheetWithRows([
        ['first', 'phone'],
        ['Bea', '4155550199']
      ])
    );
    const validBatch = await createImportBatch(
      adminCtx,
      adminActor,
      { fileName: 'contacts.xlsx', fileType: 'xlsx', importedSource: 'csv_other' },
      valid,
      { db: env.db }
    );
    const dry = await dryRunContactBatch(
      adminCtx,
      adminActor,
      validBatch.id,
      { firstName: 'first', phone: 'phone' },
      { db: env.db }
    );
    expect(dry.failed).toBe(0);
    expect(dry.ok).toBe(1);
    await commitContactBatch(adminCtx, adminActor, validBatch.id, { db: env.db });
    const storedBefore = (await storage.list(`${IDS.tenantA}/imports/`)).length;
    await expect(
      createImportBatch(
        adminCtx,
        adminActor,
        { fileName: 'bomb.xlsx', fileType: 'xlsx', importedSource: 'csv_other' },
        buildZip([
          { name: 'xl/workbook.xml', data: Buffer.from('x'), uncompressedSize: 2_000_000_000 }
        ]),
        { db: env.db }
      )
    ).rejects.toMatchObject({ fieldErrors: { file: ['uncompressed_too_large'] } });
    await expect(
      createImportBatch(
        adminCtx,
        adminActor,
        { fileName: 'macro.xlsx', fileType: 'xlsx', importedSource: 'csv_other' },
        buildXlsx(sheetWithRows([['a']]), [
          { name: 'xl/vbaProject.bin', data: Buffer.from('not a macro') }
        ]),
        { db: env.db }
      )
    ).rejects.toMatchObject({ fieldErrors: { file: ['macros'] } });
    expect(await storage.list(`${IDS.tenantA}/imports/`)).toHaveLength(storedBefore);
  });

  it('refuses saving Retell and leaves the stored agent reference unchanged', async () => {
    await env.test.admin`
      update alex_configs set provider = 'retell', agent_ref = 'synthetic-kept-ref' where tenant_id = ${IDS.tenantA}`;
    await expect(
      updateAdminAlexConfig(
        { tenantId: IDS.tenantA, userId: IDS.admin },
        { provider: 'retell' },
        { db: env.db }
      )
    ).rejects.toMatchObject({ fieldErrors: { provider: ['retell_parked'] } });
    const [row] = await env.test.admin`
      select provider, agent_ref from alex_configs where tenant_id = ${IDS.tenantA}`;
    expect(row).toMatchObject({ provider: 'retell', agent_ref: 'synthetic-kept-ref' });
  });
});
