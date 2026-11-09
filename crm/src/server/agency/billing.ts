import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { StaffCaller } from '../admin/users';
import type { Db } from '../db/client';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import { getEnv } from '../env';
import { inAgency } from './index';
import { termsSchema, stubStripeEvent, billingTransition } from './billing-policy';
type Options = { db?: Db; now?: Date };
export type DealTerms = {
  deal_id: string;
  currency: string;
  setup_cents: number;
  monthly_cents: number | null;
  installments: number[];
};
export type InvoiceDraft = {
  id: string;
  deal_id: string;
  cycle_key: string;
  amount_cents: number;
  currency: string;
  due_on: string;
  status: string;
  terms_hash: string;
  last_event_created: number;
};
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function stubOnly() {
  if (getEnv().PROVIDER_MODE !== 'stub')
    throw new AppError('FORBIDDEN', {
      message: 'Agency billing supports stub mode only. No live Stripe operations.'
    });
}
export async function saveAgencyTerms(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const i = parseInput(termsSchema, raw);
  stubOnly();
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const found = await tx.execute(
        sql`select id from deals where id=${i.dealId} and deleted_at is null for update`
      );
      if (!found.length) throw new AppError('NOT_FOUND');
      await tx.execute(sql`insert into agency_deal_terms(tenant_id,deal_id,currency,setup_cents,monthly_cents,installments,updated_by)
   values(${tenantId},${i.dealId},${i.currency},${i.setupCents},${i.monthlyCents},${JSON.stringify(i.installments)}::jsonb,${caller.id})
   on conflict(tenant_id,deal_id) do update set currency=excluded.currency,setup_cents=excluded.setup_cents,monthly_cents=excluded.monthly_cents,installments=excluded.installments,updated_by=excluded.updated_by,updated_at=now()`);
    },
    opts
  );
}
export async function createAgencyInvoice(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const i = parseInput(
    z.strictObject({
      dealId: z.uuid(),
      kind: z.enum(['setup', 'monthly']),
      installment: z.number().int().min(0).max(11).default(0),
      period: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .optional(),
      dueOn: z.iso.date()
    }),
    raw
  );
  stubOnly();
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const [t] = await tx.execute<DealTerms>(
        sql`select deal_id,currency,setup_cents,monthly_cents,installments from agency_deal_terms where deal_id=${i.dealId} for update`
      );
      if (!t) throw new AppError('NOT_FOUND');
      const amount =
        i.kind === 'monthly'
          ? t.monthly_cents
          : t.installments.length
            ? t.installments[i.installment]
            : i.installment === 0
              ? t.setup_cents
              : null;
      if (!amount || (i.kind === 'monthly' && !i.period)) throw new AppError('VALIDATION_FAILED');
      const key = i.kind === 'monthly' ? `monthly/${i.period}` : `setup/${i.installment}`,
        snapshot = hash({ terms: t, amount, dueOn: i.dueOn, cycle: key });
      const [row] =
        await tx.execute<InvoiceDraft>(sql`insert into agency_invoice_drafts(tenant_id,deal_id,cycle_key,terms_hash,amount_cents,currency,due_on)
   values(${tenantId},${i.dealId},${key},${snapshot},${amount},${t.currency},${i.dueOn}) on conflict do nothing returning *`);
      if (row) return row;
      const [prior] = await tx.execute<InvoiceDraft>(
        sql`select * from agency_invoice_drafts where deal_id=${i.dealId} and cycle_key=${key}`
      );
      if (!prior || prior.terms_hash !== snapshot)
        throw new AppError('CONFLICT', {
          message: 'An invoice already exists with different terms for this billing period.'
        });
      return prior;
    },
    opts
  );
}
/** Session-admin-only simulator for Stripe-shaped events. Not a public Stripe webhook endpoint. */
export async function applyAgencyBillingWebhook(
  caller: StaffCaller,
  raw: unknown,
  opts: Options = {}
) {
  const e = parseInput(stubStripeEvent, raw);
  stubOnly();
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const object = e.data.object;
      const [invoice] = await tx.execute<InvoiceDraft>(
        sql`select * from agency_invoice_drafts where id=${object.metadata.agencyInvoiceId} for update`
      );
      if (!invoice) throw new AppError('NOT_FOUND');
      if (object.id !== `in_dev_${invoice.id}` || object.amount_due !== invoice.amount_cents)
        throw new AppError('CONFLICT');
      const payloadHash = hash(e);
      const inserted = await tx.execute(
        sql`insert into agency_billing_events(tenant_id,event_id,invoice_id,payload_hash) values(${tenantId},${e.id},${invoice.id},${payloadHash}) on conflict do nothing returning event_id`
      );
      if (!inserted.length) {
        const [prior] = await tx.execute<{ payload_hash: string }>(
          sql`select payload_hash from agency_billing_events where event_id=${e.id}`
        );
        if (prior.payload_hash !== payloadHash) throw new AppError('CONFLICT');
        return { duplicate: true, providerRequests: 0 };
      }
      if (e.created < Number(invoice.last_event_created))
        return { ignored: 'stale', providerRequests: 0 };
      const status = billingTransition(invoice.status, e.type);
      await tx.execute(
        sql`update agency_invoice_drafts set status=${status},last_event_created=${e.created} where id=${invoice.id}`
      );
      return { status, providerRequests: 0 };
    },
    opts
  );
}
export async function draftAgencyDunning(caller: StaffCaller, opts: Options = {}) {
  stubOnly();
  const day = (opts.now ?? new Date()).toISOString().slice(0, 10);
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const rows =
        await tx.execute(sql`insert into agency_dunning_drafts(tenant_id,invoice_id,day,body)
   select ${tenantId},id,${day},'Draft reminder: please review the outstanding invoice. No payment has been charged.' from agency_invoice_drafts where status in ('open','past_due') and due_on<${day}::date on conflict do nothing returning id`);
      return { drafted: rows.length, delivered: false, charged: false };
    },
    opts
  );
}
export async function getAgencyBilling(caller: StaffCaller, opts: Options = {}) {
  return inAgency(
    caller,
    async (tx) => ({
      terms: Array.from(
        await tx.execute<DealTerms>(
          sql`select deal_id,currency,setup_cents,monthly_cents,installments from agency_deal_terms order by updated_at desc limit 100`
        )
      ),
      invoices: Array.from(
        await tx.execute<InvoiceDraft>(
          sql`select * from agency_invoice_drafts order by created_at desc,id desc limit 100`
        )
      ),
      reminders: Array.from(
        await tx.execute<{ id: string; invoice_id: string; body: string }>(
          sql`select d.id,d.invoice_id,d.body from agency_dunning_drafts d join agency_invoice_drafts i on i.id=d.invoice_id where i.status in ('open','past_due') order by d.created_at desc limit 100`
        )
      )
    }),
    opts
  );
}
