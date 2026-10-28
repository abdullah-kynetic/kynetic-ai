import { createHash } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { can, type Actor } from '../auth/permissions';
import { getStorage } from '../adapters/storage';
import type { Db, Tx } from '../db/client';
import { companies, contacts, dealContacts, deals, importBatchRecords, importBatches, notes, pipelines, pipelineStages } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { normalizePhone } from '../contacts/phone';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseImportCsv } from './csv';
import { requireModule } from '../modules';
import { positionBetween } from '../deals/position';

type Entity = 'company' | 'deal' | 'note';
type Mapping = Record<string, string>;
type Report = { total: number; ok: number; failed: number; duplicates: number; issues: { row: number; reason: string }[] };
type Options = { db?: Db; afterEntityRow?: (imported: number) => void | Promise<void> };

const fields: Record<Entity, string[]> = {
  company: ['name', 'phone', 'website', 'externalId'],
  deal: ['title', 'valueCents', 'serviceType', 'expectedClose', 'stage', 'contactExternalId', 'externalId'],
  note: ['body', 'contactExternalId', 'companyExternalId', 'dealExternalId', 'externalId']
};
const mappingSchema = z.record(z.string(), z.string());
const cell = (row: string[], index: number) => (index < 0 ? '' : (row[index] ?? '').trim());

function mapRows(rows: string[][], entity: Entity, mapping: Mapping) {
  const [header = [], ...data] = rows;
  if (Object.keys(mapping).some((key) => !fields[entity].includes(key)) || Object.values(mapping).some((name) => !header.includes(name)))
    throw new Error('invalid_mapping');
  const indexes = Object.fromEntries(Object.entries(mapping).map(([key, name]) => [key, header.indexOf(name)]));
  return data.map((row, index) => ({ rowNumber: index + 2, value: Object.fromEntries(fields[entity].map((key) => [key, cell(row, indexes[key] ?? -1)])) }));
}

function validate(entity: Entity, value: Record<string, string>): string | null {
  if (entity === 'company') return value.name ? null : 'name_required';
  if (entity === 'deal') {
    if (!value.title) return 'title_required';
    if (value.valueCents && (!/^\d+$/.test(value.valueCents) || Number(value.valueCents) > 2_147_483_647)) return 'value_cents_invalid';
    if (value.expectedClose && !/^\d{4}-\d{2}-\d{2}$/.test(value.expectedClose)) return 'expected_close_invalid';
    return null;
  }
  const refs = ['contactExternalId', 'companyExternalId', 'dealExternalId'].filter((key) => value[key]);
  if (!value.body) return 'body_required';
  if (refs.length !== 1) return 'exactly_one_parent_required';
  return null;
}

export async function dryRunEntityBatch(ctx: TenantContextInput, actor: Actor, batchId: string, rawMapping: unknown, opts: Options = {}): Promise<Report> {
  if (!can(actor, 'import.onboarding', ctx.tenantId)) throw new AppError('FORBIDDEN');
  const mapping = mappingSchema.safeParse(rawMapping);
  if (!mapping.success || !z.uuid().safeParse(batchId).success) throw new ValidationError({ mapping: ['invalid'] });
  return withTenant(ctx, async (tx) => {
    await requireModule(ctx, 'platform', { tx });
    const [batch] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
    if (!batch) throw new AppError('NOT_FOUND');
    if (!batch.fileKey || batch.fileType !== 'csv' || batch.entity === 'contact' || !['uploaded', 'mapped', 'dry_run_ok', 'dry_run_failed'].includes(batch.status)) throw new AppError('CONFLICT');
    const stored = await getStorage().get(batch.fileKey);
    if (!stored || !batch.fileSha256 || createHash('sha256').update(stored.body).digest('hex') !== batch.fileSha256) throw new AppError('CONFLICT');
    let parsed: { rowNumber: number; value: Record<string, string> }[];
    try { parsed = mapRows(parseImportCsv(stored.body), batch.entity as Entity, mapping.data); }
    catch { throw new ValidationError({ mapping: ['invalid_column_or_file'] }); }
    const issues: Report['issues'] = [];
    const seen = new Set<string>();
    let ok = 0, failed = 0, duplicates = 0;
    for (const item of parsed) {
      const problem = await entityRowIssue(tx, ctx.tenantId, batch.entity as Entity, item.value);
      if (problem) {
        failed++;
        if (issues.length < 200) issues.push({ row: item.rowNumber, reason: problem });
        continue;
      }
      const external = item.value.externalId;
      if (external && (seen.has(external) || await findExternal(tx, ctx.tenantId, batch.entity as Entity, batch.importedSource, external))) { duplicates++; continue; }
      if (external) seen.add(external);
      ok++;
    }
    const report = { total: parsed.length, ok, failed, duplicates, issues };
    await tx.update(importBatches).set({ mapping: mapping.data, status: failed ? 'dry_run_failed' : 'dry_run_ok', rowsTotal: report.total, rowsOk: ok, rowsFailed: failed, rowsDuplicate: duplicates, report }).where(eq(importBatches.id, batch.id));
    await audit(tx, { action: 'import.dry_run', entity: 'import_batch', entityId: batch.id, after: report });
    return report;
  }, opts);
}

export async function commitEntityBatch(ctx: TenantContextInput, actor: Actor, batchId: string, opts: Options = {}): Promise<{ imported: number; failed: number; duplicates: number }> {
  if (!can(actor, 'import.onboarding', ctx.tenantId)) throw new AppError('FORBIDDEN');
  return withTenant(ctx, async (tx) => {
    await requireModule(ctx, 'platform', { tx });
    const [batch] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
    if (!batch) throw new AppError('NOT_FOUND');
    if (!batch.fileKey || batch.fileType !== 'csv' || batch.entity === 'contact' || !['dry_run_ok', 'dry_run_failed'].includes(batch.status)) throw new AppError('CONFLICT');
    const mapping = mappingSchema.safeParse(batch.mapping);
    const stored = await getStorage().get(batch.fileKey);
    if (!mapping.success || !stored || !batch.fileSha256 || createHash('sha256').update(stored.body).digest('hex') !== batch.fileSha256) throw new AppError('CONFLICT');
    const rows = mapRows(parseImportCsv(stored.body), batch.entity as Entity, mapping.data);
    if (rows.length !== batch.rowsTotal) throw new AppError('CONFLICT');
    let imported = 0, failed = 0, duplicates = 0;
    const seen = new Set<string>();
    const created: { tenantId: string; batchId: string; entity: Entity; recordId: string; action: 'created' }[] = [];
    const entity = batch.entity as Entity;
    let interrupted = false;
    for (const { value } of rows) {
      if (await entityRowIssue(tx, ctx.tenantId, entity, value)) { failed++; continue; }
      const externalId = value.externalId || null;
      if (externalId && seen.has(externalId)) { duplicates++; continue; }
      if (externalId) seen.add(externalId);
      const existing = externalId ? await findExternal(tx, ctx.tenantId, entity, batch.importedSource, externalId) : null;
      if (existing) { duplicates++; continue; }
      const id = crypto.randomUUID();
      if (entity === 'company') {
        const phone = value.phone ? normalizePhone(value.phone) : null;
        if (value.phone && !phone) { failed++; continue; }
        await tx.insert(companies).values({ id, tenantId: ctx.tenantId, name: value.name!, phoneE164: phone, website: value.website || null, importedSource: batch.importedSource, importBatchId: batch.id, externalId });
      } else if (entity === 'deal') {
        const [pipeline] = await tx.select().from(pipelines).where(eq(pipelines.tenantId, ctx.tenantId)).orderBy(asc(pipelines.position)).limit(1);
        if (!pipeline) { failed++; continue; }
        const stages = await tx.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id)).orderBy(asc(pipelineStages.position));
        const stage = value.stage ? stages.find((candidate) => candidate.name.toLowerCase() === value.stage!.toLowerCase()) : stages[0];
        if (!stage) { failed++; continue; }
        let contactId: string | null = null;
        if (value.contactExternalId) {
          const [contact] = await tx.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.tenantId, ctx.tenantId), eq(contacts.externalId, value.contactExternalId), isNull(contacts.deletedAt))).limit(1);
          if (!contact) { failed++; continue; }
          contactId = contact.id;
        }
        const [last] = await tx.select({ position: deals.position }).from(deals).where(and(eq(deals.tenantId, ctx.tenantId), eq(deals.stageId, stage.id), isNull(deals.deletedAt))).orderBy(deals.position).limit(1);
        await tx.insert(deals).values({ id, tenantId: ctx.tenantId, pipelineId: pipeline.id, stageId: stage.id, title: value.title!, valueCents: Number(value.valueCents || 0), serviceType: value.serviceType || null, expectedClose: value.expectedClose || null, position: positionBetween(last?.position ?? null, null), importedSource: batch.importedSource, importBatchId: batch.id, externalId });
        if (contactId) await tx.insert(dealContacts).values({ tenantId: ctx.tenantId, dealId: id, contactId, role: 'homeowner' });
      } else {
        const parentKey = value.contactExternalId ? 'contact' : value.companyExternalId ? 'company' : 'deal';
        const external = value.contactExternalId || value.companyExternalId || value.dealExternalId!;
        const parent = parentKey === 'contact'
          ? (await tx.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.tenantId, ctx.tenantId), eq(contacts.externalId, external), isNull(contacts.deletedAt))).limit(1))[0]
          : parentKey === 'company'
            ? (await tx.select({ id: companies.id }).from(companies).where(and(eq(companies.tenantId, ctx.tenantId), eq(companies.externalId, external), isNull(companies.deletedAt))).limit(1))[0]
            : (await tx.select({ id: deals.id }).from(deals).where(and(eq(deals.tenantId, ctx.tenantId), eq(deals.externalId, external), isNull(deals.deletedAt))).limit(1))[0];
        if (!parent) { failed++; continue; }
        const parentId = parent.id;
        const escaped = value.body!.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('\n', '<br>');
        await tx.insert(notes).values({ id, tenantId: ctx.tenantId, bodyText: value.body!, bodyJson: { html: escaped }, contactId: parentKey === 'contact' ? parentId : null, companyId: parentKey === 'company' ? parentId : null, dealId: parentKey === 'deal' ? parentId : null, importedSource: batch.importedSource, importBatchId: batch.id, externalId });
      }
      created.push({ tenantId: ctx.tenantId, batchId: batch.id, entity, recordId: id, action: 'created' });
      imported++;
      try {
        await opts.afterEntityRow?.(imported);
      } catch {
        interrupted = true;
        break;
      }
    }
    if (created.length) await tx.insert(importBatchRecords).values(created);
    const finishedAt = new Date().toISOString();
    const report = { ...(batch.report as Record<string, unknown>), commit: { imported, failed, duplicates } };
    await tx.update(importBatches).set({ status: interrupted ? 'failed' : 'done', committedAt: finishedAt, report }).where(eq(importBatches.id, batch.id));
    await audit(tx, { action: interrupted ? 'import.commit_partial_failure' : 'import.commit', entity: 'import_batch', entityId: batch.id, after: { imported, failed, duplicates, interrupted } });
    return { imported, failed, duplicates };
  }, opts);
}

async function entityRowIssue(tx: Tx, tenantId: string, entity: Entity, value: Record<string, string>): Promise<string | null> {
  const base = validate(entity, value);
  if (base) return base;
  if (entity === 'deal') {
    const [pipeline] = await tx.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.tenantId, tenantId)).orderBy(asc(pipelines.position)).limit(1);
    if (!pipeline) return 'pipeline_missing';
    const stages = await tx.select({ name: pipelineStages.name, isWon: pipelineStages.isWon, isLost: pipelineStages.isLost }).from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id));
    if (value.stage && !stages.some((stage) => stage.name.toLowerCase() === value.stage!.toLowerCase() && !stage.isWon && !stage.isLost)) return 'stage_not_found';
    if (value.contactExternalId) {
      const [contact] = await tx.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.externalId, value.contactExternalId), isNull(contacts.deletedAt))).limit(1);
      if (!contact) return 'contact_not_found';
    }
  } else if (entity === 'note') {
    const key = value.contactExternalId ? 'contact' : value.companyExternalId ? 'company' : 'deal';
    const externalId = value.contactExternalId || value.companyExternalId || value.dealExternalId!;
    const found = key === 'contact'
      ? (await tx.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.externalId, externalId), isNull(contacts.deletedAt))).limit(1))[0]
      : key === 'company'
        ? (await tx.select({ id: companies.id }).from(companies).where(and(eq(companies.tenantId, tenantId), eq(companies.externalId, externalId), isNull(companies.deletedAt))).limit(1))[0]
        : (await tx.select({ id: deals.id }).from(deals).where(and(eq(deals.tenantId, tenantId), eq(deals.externalId, externalId), isNull(deals.deletedAt))).limit(1))[0];
    if (!found) return `${key}_not_found`;
  }
  return null;
}

async function findExternal(tx: Tx, tenantId: string, entity: Entity, source: string, externalId: string) {
  if (entity === 'company') {
    const [row] = await tx.select({ id: companies.id }).from(companies)
      .where(and(eq(companies.tenantId, tenantId), eq(companies.importedSource, source), eq(companies.externalId, externalId), isNull(companies.deletedAt))).limit(1);
    return row ?? null;
  }
  if (entity === 'deal') {
    const [row] = await tx.select({ id: deals.id }).from(deals)
      .where(and(eq(deals.tenantId, tenantId), eq(deals.importedSource, source), eq(deals.externalId, externalId), isNull(deals.deletedAt))).limit(1);
    return row ?? null;
  }
  const [row] = await tx.select({ id: notes.id }).from(notes)
    .where(and(eq(notes.tenantId, tenantId), eq(notes.importedSource, source), eq(notes.externalId, externalId), isNull(notes.deletedAt))).limit(1);
  return row ?? null;
}
