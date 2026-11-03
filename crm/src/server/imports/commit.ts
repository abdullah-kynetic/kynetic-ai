import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { can, type Actor } from '../auth/permissions';
import type { Db } from '../db/client';
import { getStorage } from '../adapters/storage';
import {
  companies,
  consents,
  contacts,
  deals,
  importBatchRecords,
  importBatches,
  notes
} from '../db/schema';
import { AppError } from '../errors';
import { withTenant, type TenantContextInput } from '../tenancy';
import { createContactSchema } from '../contacts/schemas';
import { parseInput } from '../validation';
import { parseImportCsv } from './csv';
import type { ContactDryRun, ContactMapping } from './dry-run';
import { mappingSchema, previewContacts } from './dry-run';
import { recordConsent, revokeConsent } from '../consent';
import { requireModule } from '../modules';

type Options = { db?: Db };

function textAt(row: string[], index: number): string {
  return (row[index] ?? '').trim();
}

function parseRow(row: string[], headers: string[], mapping: ContactMapping) {
  const column = (key: keyof ContactMapping) =>
    mapping[key] ? headers.indexOf(mapping[key]!) : -1;
  const phone = textAt(row, column('phone'));
  const email = textAt(row, column('email')).toLowerCase();
  const parsed = createContactSchema.safeParse({
    firstName: textAt(row, column('firstName')),
    lastName: textAt(row, column('lastName')) || null,
    phones: phone ? [phone] : [],
    emails: email ? [email] : []
  });
  if (!parsed.success) return null;
  const channel = textAt(row, column('consentChannel'));
  const consentDate = textAt(row, column('consentDate'));
  const evidence = textAt(row, column('consentEvidence'));
  const consent =
    ['phone_call', 'sms', 'email'].includes(channel) &&
    evidence &&
    /^\d{4}-\d{2}-\d{2}$/.test(consentDate)
      ? {
          channel: channel as 'phone_call' | 'sms' | 'email',
          capturedAt: new Date(`${consentDate}T12:00:00.000Z`),
          capturedText: evidence
        }
      : null;
  return { value: parsed.data, externalId: textAt(row, column('externalId')) || null, consent };
}

export async function commitContactBatch(
  ctx: TenantContextInput,
  actor: Actor,
  batchId: string,
  opts: Options = {}
): Promise<{ imported: number; filled: number; skipped: number; failed: number }> {
  if (!can(actor, 'import.onboarding', ctx.tenantId)) throw new AppError('FORBIDDEN');
  parseInput(z.uuid(), batchId);
  return withTenant(
    ctx,
    async (tx) => {
      await requireModule(ctx, 'platform', { tx });
      const [batch] = await tx
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, batchId))
        .limit(1);
      if (!batch) throw new AppError('NOT_FOUND');
      if (
        !batch.fileKey ||
        batch.fileType !== 'csv' ||
        !['dry_run_ok', 'dry_run_failed'].includes(batch.status)
      ) {
        throw new AppError('CONFLICT', {
          message: 'A completed dry run is required before commit.'
        });
      }
      const mapping = mappingSchema.safeParse(batch.mapping);
      const stored = await getStorage().get(batch.fileKey);
      if (!mapping.success || !stored || !batch.fileSha256) throw new AppError('CONFLICT');
      if (createHash('sha256').update(stored.body).digest('hex') !== batch.fileSha256)
        throw new AppError('CONFLICT');
      const rows = parseImportCsv(stored.body);
      const report = previewContacts(rows, mapping.data, { phones: [], emails: [] });
      if (report.total !== batch.rowsTotal)
        throw new AppError('CONFLICT', {
          message: 'The uploaded file no longer matches its dry run.'
        });

      const [header = [], ...data] = rows;
      const existing = await tx
        .select({
          id: contacts.id,
          tenantId: contacts.tenantId,
          phones: contacts.phones,
          emails: contacts.emails,
          firstName: contacts.firstName,
          lastName: contacts.lastName
        })
        .from(contacts)
        .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)));
      const seenExternal = new Set<string>();
      const createdRecords: {
        tenantId: string;
        batchId: string;
        entity: 'contact';
        recordId: string;
        action: 'created';
      }[] = [];
      const consentRecords: {
        tenantId: string;
        batchId: string;
        entity: 'consent';
        recordId: string;
        action: 'created';
      }[] = [];
      const filledRecords: {
        tenantId: string;
        batchId: string;
        entity: 'contact';
        recordId: string;
        action: 'filled_empty';
        priorValues: Record<string, unknown>;
      }[] = [];
      let imported = 0;
      let filled = 0;
      let skipped = 0;
      let failed = 0;

      for (const row of data) {
        const parsed = parseRow(row, header, mapping.data);
        if (!parsed) {
          failed++;
          continue;
        }
        if (parsed.externalId && seenExternal.has(parsed.externalId)) {
          skipped++;
          continue;
        }
        if (parsed.externalId) seenExternal.add(parsed.externalId);
        const phone = parsed.value.phones[0];
        const email = parsed.value.emails[0];
        const match = existing.find(
          (contact) =>
            (phone && contact.phones.includes(phone)) || (email && contact.emails.includes(email))
        );
        if (match) {
          skipped++;
          if (parsed.consent) {
            const consent = await recordConsent(
              ctx,
              { contactId: match.id, ...parsed.consent, source: 'import' },
              { tx }
            );
            consentRecords.push({
              tenantId: ctx.tenantId,
              batchId,
              entity: 'consent',
              recordId: consent.id,
              action: 'created'
            });
          }
          if (batch.duplicateRule !== 'fill_empty') continue;
          const changes: Partial<typeof contacts.$inferInsert> = {};
          const prior: Record<string, unknown> = {};
          if (!match.firstName && parsed.value.firstName) {
            prior.firstName = match.firstName;
            changes.firstName = parsed.value.firstName;
          }
          if (!match.lastName && parsed.value.lastName) {
            prior.lastName = match.lastName;
            changes.lastName = parsed.value.lastName;
          }
          if (match.phones.length === 0 && parsed.value.phones.length) {
            prior.phones = match.phones;
            changes.phones = parsed.value.phones;
            changes.primaryPhoneE164 = parsed.value.phones[0] ?? null;
          }
          if (match.emails.length === 0 && parsed.value.emails.length) {
            prior.emails = match.emails;
            changes.emails = parsed.value.emails;
            changes.primaryEmail = parsed.value.emails[0] ?? null;
          }
          if (Object.keys(changes).length) {
            await tx
              .update(contacts)
              .set({ ...changes, updatedAt: new Date().toISOString() })
              .where(and(eq(contacts.id, match.id), eq(contacts.tenantId, ctx.tenantId)));
            filledRecords.push({
              tenantId: ctx.tenantId,
              batchId,
              entity: 'contact',
              recordId: match.id,
              action: 'filled_empty',
              priorValues: prior
            });
            filled++;
          }
          continue;
        }
        const id = crypto.randomUUID();
        const [contact] = await tx
          .insert(contacts)
          .values({
            id,
            tenantId: ctx.tenantId,
            firstName: parsed.value.firstName,
            lastName: parsed.value.lastName ?? null,
            phones: parsed.value.phones,
            emails: parsed.value.emails,
            primaryPhoneE164: parsed.value.phones[0] ?? null,
            primaryEmail: parsed.value.emails[0] ?? null,
            status: parsed.value.status,
            tags: [],
            importedSource: batch.importedSource,
            importBatchId: batch.id,
            externalId: parsed.externalId
          })
          .returning({ id: contacts.id });
        existing.push({
          id: contact.id,
          tenantId: ctx.tenantId,
          phones: parsed.value.phones,
          emails: parsed.value.emails,
          firstName: parsed.value.firstName,
          lastName: parsed.value.lastName ?? null
        });
        createdRecords.push({
          tenantId: ctx.tenantId,
          batchId,
          entity: 'contact',
          recordId: contact.id,
          action: 'created'
        });
        if (parsed.consent) {
          const consent = await recordConsent(
            ctx,
            { contactId: contact.id, ...parsed.consent, source: 'import' },
            { tx }
          );
          consentRecords.push({
            tenantId: ctx.tenantId,
            batchId,
            entity: 'consent',
            recordId: consent.id,
            action: 'created'
          });
        }
        imported++;
      }

      const allRecords = [...createdRecords, ...filledRecords, ...consentRecords];
      for (let offset = 0; offset < allRecords.length; offset += 500) {
        const chunk = allRecords.slice(offset, offset + 500);
        await tx.insert(importBatchRecords).values(chunk);
      }
      const finishedAt = new Date().toISOString();
      const finalReport: ContactDryRun & {
        commit: {
          imported: number;
          filled: number;
          skipped: number;
          failed: number;
          consents: number;
        };
      } = {
        ...(batch.report as ContactDryRun),
        commit: { imported, filled, skipped, failed, consents: consentRecords.length }
      };
      await tx
        .update(importBatches)
        .set({ status: 'done', committedAt: finishedAt, report: finalReport })
        .where(eq(importBatches.id, batch.id));
      await audit(tx, {
        action: 'import.commit',
        entity: 'import_batch',
        entityId: batch.id,
        after: { imported, filled, skipped, failed, consents: consentRecords.length }
      });
      return { imported, filled, skipped, failed, consents: consentRecords.length };
    },
    opts
  );
}

export async function undoImportBatch(
  ctx: TenantContextInput,
  actor: Actor,
  batchId: string,
  opts: Options = {}
) {
  if (!can(actor, 'import.onboarding', ctx.tenantId)) throw new AppError('FORBIDDEN');
  parseInput(z.uuid(), batchId);
  return withTenant(
    ctx,
    async (tx) => {
      await requireModule(ctx, 'platform', { tx });
      const [batch] = await tx
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, batchId))
        .limit(1);
      if (!batch) throw new AppError('NOT_FOUND');
      if (!['done', 'failed'].includes(batch.status) || !batch.committedAt)
        throw new AppError('CONFLICT');
      const records = await tx
        .select()
        .from(importBatchRecords)
        .where(eq(importBatchRecords.batchId, batchId));
      const skipped: string[] = [];
      let removed = 0;
      let restored = 0;
      for (const record of records) {
        if (record.entity === 'consent') {
          const [consent] = await tx
            .select()
            .from(consents)
            .where(and(eq(consents.id, record.recordId), eq(consents.tenantId, ctx.tenantId)))
            .limit(1);
          if (!consent || consent.kind !== 'express_written') {
            skipped.push(record.recordId);
            continue;
          }
          await revokeConsent(
            ctx,
            {
              contactId: consent.contactId,
              channel: consent.channel as 'phone_call' | 'sms' | 'email',
              source: 'staff'
            },
            { tx }
          );
          restored++;
          continue;
        }
        let current: { id: string; updatedAt: string } | undefined;
        if (record.entity === 'contact') {
          [current] = await tx
            .select({ id: contacts.id, updatedAt: contacts.updatedAt })
            .from(contacts)
            .where(and(eq(contacts.id, record.recordId), eq(contacts.tenantId, ctx.tenantId)))
            .limit(1);
        } else if (record.entity === 'company') {
          [current] = await tx
            .select({ id: companies.id, updatedAt: companies.updatedAt })
            .from(companies)
            .where(and(eq(companies.id, record.recordId), eq(companies.tenantId, ctx.tenantId)))
            .limit(1);
        } else if (record.entity === 'deal') {
          [current] = await tx
            .select({ id: deals.id, updatedAt: deals.updatedAt })
            .from(deals)
            .where(and(eq(deals.id, record.recordId), eq(deals.tenantId, ctx.tenantId)))
            .limit(1);
        } else if (record.entity === 'note') {
          [current] = await tx
            .select({ id: notes.id, updatedAt: notes.updatedAt })
            .from(notes)
            .where(and(eq(notes.id, record.recordId), eq(notes.tenantId, ctx.tenantId)))
            .limit(1);
        }
        if (!current || current.updatedAt > batch.committedAt) {
          skipped.push(record.recordId);
          continue;
        }
        if (record.action === 'created') {
          const now = new Date().toISOString();
          if (record.entity === 'contact')
            await tx
              .update(contacts)
              .set({ deletedAt: now, updatedAt: now })
              .where(eq(contacts.id, current.id));
          else if (record.entity === 'company')
            await tx
              .update(companies)
              .set({ deletedAt: now, updatedAt: now })
              .where(eq(companies.id, current.id));
          else if (record.entity === 'deal')
            await tx
              .update(deals)
              .set({ deletedAt: now, updatedAt: now })
              .where(eq(deals.id, current.id));
          else if (record.entity === 'note')
            await tx
              .update(notes)
              .set({ deletedAt: now, updatedAt: now })
              .where(eq(notes.id, current.id));
          removed++;
        } else {
          if (record.entity !== 'contact') {
            skipped.push(record.recordId);
            continue;
          }
          const prior = z.record(z.string(), z.unknown()).parse(record.priorValues ?? {});
          await tx
            .update(contacts)
            .set({ ...prior, updatedAt: new Date().toISOString() })
            .where(eq(contacts.id, current.id));
          restored++;
        }
      }
      await tx
        .update(importBatches)
        .set({
          status: 'undone',
          undoneAt: new Date().toISOString(),
          undoneBy: actor.userId,
          report: {
            ...(batch.report as Record<string, unknown>),
            undo: { removed, restored, skipped }
          }
        })
        .where(eq(importBatches.id, batchId));
      await audit(tx, {
        action: 'import.undo',
        entity: 'import_batch',
        entityId: batchId,
        after: { removed, restored, skipped: skipped.length }
      });
      return { removed, restored, skipped };
    },
    opts
  );
}

export async function listImportBatches(ctx: TenantContextInput, actor: Actor, opts: Options = {}) {
  if (!can(actor, 'import.onboarding', ctx.tenantId)) throw new AppError('FORBIDDEN');
  await requireModule(ctx, 'platform', opts);
  return withTenant(
    ctx,
    (tx) => tx.select().from(importBatches).orderBy(importBatches.createdAt),
    opts
  );
}
