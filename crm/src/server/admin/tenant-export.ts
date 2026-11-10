import { eq } from 'drizzle-orm';
import { getStorage, mintSignedUrl, type StorageAdapter } from '../adapters/storage';
import { audit } from '../audit';
import { getWorkerDb, type Db } from '../db/client';
import {
  activities,
  appointments,
  calls,
  companies,
  contacts,
  deals,
  messages,
  notes,
  tasks,
  tenantExports
} from '../db/schema';
import { AppError } from '../errors';
import { registerWorker } from '../jobs';
import { asTenantAdmin } from './tenant-admin';
import { zipStored } from './csv-zip';
import { neutralizeCsvCell } from '../contacts/export';
import { withTenant } from '../tenancy';
import type { StaffCaller } from './users';

export type TenantExportJob = { tenantId: string; exportId: string };

function csv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map((header) => neutralizeCsvCell(header)).join(',')];
  for (const row of rows) lines.push(row.map((cell) => neutralizeCsvCell(cell)).join(','));
  return `${lines.join('\n')}\n`;
}

async function tableCsv(tenantId: string, db: Db): Promise<{ name: string; body: string }[]> {
  return withTenant(
    { tenantId, role: 'system' },
    async (tx) => {
      const contactRows = await tx
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          phone: contacts.primaryPhoneE164,
          email: contacts.primaryEmail,
          status: contacts.status,
          source: contacts.source,
          createdAt: contacts.createdAt
        })
        .from(contacts)
        .where(eq(contacts.tenantId, tenantId));
      const companyRows = await tx
        .select({
          id: companies.id,
          name: companies.name,
          phone: companies.phoneE164,
          website: companies.website
        })
        .from(companies)
        .where(eq(companies.tenantId, tenantId));
      const dealRows = await tx
        .select({
          id: deals.id,
          title: deals.title,
          valueCents: deals.valueCents,
          stageId: deals.stageId,
          wonAt: deals.wonAt,
          createdAt: deals.createdAt
        })
        .from(deals)
        .where(eq(deals.tenantId, tenantId));
      const noteRows = await tx
        .select({
          id: notes.id,
          body: notes.bodyText,
          contactId: notes.contactId,
          createdAt: notes.createdAt
        })
        .from(notes)
        .where(eq(notes.tenantId, tenantId));
      const taskRows = await tx
        .select({
          id: tasks.id,
          title: tasks.title,
          dueAt: tasks.dueAt,
          contactId: tasks.contactId,
          completedAt: tasks.completedAt
        })
        .from(tasks)
        .where(eq(tasks.tenantId, tenantId));
      const appointmentRows = await tx
        .select({
          id: appointments.id,
          contactId: appointments.contactId,
          startsAt: appointments.startsAt,
          endsAt: appointments.endsAt,
          status: appointments.status,
          bookedBy: appointments.bookedBy
        })
        .from(appointments)
        .where(eq(appointments.tenantId, tenantId));
      const activityRows = await tx
        .select({
          id: activities.id,
          type: activities.type,
          summary: activities.summary,
          occurredAt: activities.occurredAt,
          contactId: activities.contactId
        })
        .from(activities)
        .where(eq(activities.tenantId, tenantId));
      const callRows = await tx
        .select({
          id: calls.id,
          contactId: calls.contactId,
          direction: calls.direction,
          startedAt: calls.startedAt,
          endedAt: calls.endedAt,
          durationS: calls.durationS,
          outcome: calls.outcome,
          costCents: calls.costCents
        })
        .from(calls)
        .where(eq(calls.tenantId, tenantId));
      const messageRows = await tx
        .select({
          id: messages.id,
          contactId: messages.contactId,
          channel: messages.channel,
          direction: messages.direction,
          status: messages.status,
          sentAt: messages.sentAt,
          subject: messages.subject,
          body: messages.body
        })
        .from(messages)
        .where(eq(messages.tenantId, tenantId));
      const pack = (name: string, headers: string[], source: Record<string, unknown>[]) => ({
        name,
        body: csv(
          headers,
          source.map((row) => headers.map((header) => row[header]))
        )
      });
      return [
        pack(
          'contacts.csv',
          ['id', 'firstName', 'lastName', 'phone', 'email', 'status', 'source', 'createdAt'],
          contactRows
        ),
        pack('companies.csv', ['id', 'name', 'phone', 'website'], companyRows),
        pack('deals.csv', ['id', 'title', 'valueCents', 'stageId', 'wonAt', 'createdAt'], dealRows),
        pack('notes.csv', ['id', 'body', 'contactId', 'createdAt'], noteRows),
        pack('tasks.csv', ['id', 'title', 'dueAt', 'contactId', 'completedAt'], taskRows),
        pack(
          'appointments.csv',
          ['id', 'contactId', 'startsAt', 'endsAt', 'status', 'bookedBy'],
          appointmentRows
        ),
        pack('activities.csv', ['id', 'type', 'summary', 'occurredAt', 'contactId'], activityRows),
        pack(
          'calls.csv',
          [
            'id',
            'contactId',
            'direction',
            'startedAt',
            'endedAt',
            'durationS',
            'outcome',
            'costCents'
          ],
          callRows
        ),
        pack(
          'messages.csv',
          ['id', 'contactId', 'channel', 'direction', 'status', 'sentAt', 'subject', 'body'],
          messageRows
        )
      ];
    },
    { db }
  );
}

export async function runTenantExport(
  job: TenantExportJob,
  opts: { db?: Db; storage?: StorageAdapter } = {}
) {
  const db = opts.db ?? getWorkerDb();
  const storage = opts.storage ?? getStorage();
  try {
    const files = await tableCsv(job.tenantId, db);
    const body = zipStored(files);
    const [row] = await withTenant(
      { tenantId: job.tenantId, role: 'system' },
      (tx) =>
        tx
          .select({ storageKey: tenantExports.storageKey })
          .from(tenantExports)
          .where(eq(tenantExports.id, job.exportId))
          .limit(1),
      { db }
    );
    if (!row) throw new Error('export row missing');
    await storage.put(row.storageKey, body, { contentType: 'application/zip' });
    await withTenant(
      { tenantId: job.tenantId, role: 'system' },
      (tx) =>
        tx
          .update(tenantExports)
          .set({
            status: 'ready',
            byteSize: body.byteLength,
            readyAt: new Date().toISOString(),
            error: null
          })
          .where(eq(tenantExports.id, job.exportId)),
      { db }
    );
  } catch (error) {
    await withTenant(
      { tenantId: job.tenantId, role: 'system' },
      (tx) =>
        tx
          .update(tenantExports)
          .set({ status: 'failed', error: 'Export failed' })
          .where(eq(tenantExports.id, job.exportId)),
      { db }
    ).catch(() => undefined);
    throw error;
  }
}

export async function registerTenantExportWorker(): Promise<void> {
  await registerWorker<TenantExportJob>('tenant.export', async (job) => {
    await runTenantExport(job);
  });
}

export async function signedTenantExportUrl(
  caller: StaffCaller,
  tenantId: string,
  exportId: string,
  opts: { db?: Db; storage?: StorageAdapter } = {}
) {
  return asTenantAdmin(caller, tenantId, { db: opts.db }, async (tx) => {
    const [row] = await tx
      .select({ storageKey: tenantExports.storageKey, status: tenantExports.status })
      .from(tenantExports)
      .where(eq(tenantExports.id, exportId))
      .limit(1);
    if (!row || row.status !== 'ready') throw new AppError('NOT_FOUND');
    await audit(tx, {
      action: 'tenant.export_download',
      entity: 'tenant_export',
      entityId: exportId
    });
    const storage = opts.storage ?? getStorage();
    return mintSignedUrl(storage, tenantId, row.storageKey);
  });
}
