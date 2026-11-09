'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { agencyCaller } from '../caller';
import {
  saveAgencyTerms,
  createAgencyInvoice,
  draftAgencyDunning,
  applyAgencyBillingWebhook
} from '@/server/agency/billing';
import { dollarsToCents } from '@/server/agency/billing-policy';
import { AppError } from '@/server/errors';
export async function saveTermsAction(form: FormData) {
  const caller = await agencyCaller();
  try {
    await saveAgencyTerms(caller, {
      dealId: String(form.get('dealId') ?? ''),
      currency: 'USD',
      setupCents: dollarsToCents(String(form.get('setup') ?? '')),
      monthlyCents: form.get('monthly') ? dollarsToCents(String(form.get('monthly'))) : null,
      installments: String(form.get('installments') ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map(dollarsToCents)
    });
  } catch (error) {
    if (
      !(error instanceof AppError) &&
      !(error instanceof Error && error.message.startsWith('Enter a USD'))
    )
      throw error;
    redirect('/admin/agency/billing?error=terms');
  }
  revalidatePath('/admin/agency/billing');
}
export async function createInvoiceAction(form: FormData) {
  const caller = await agencyCaller();
  try {
    await createAgencyInvoice(caller, {
      dealId: String(form.get('dealId') ?? ''),
      kind: String(form.get('kind') ?? ''),
      installment: Number(form.get('installment') ?? 0),
      ...(form.get('period') ? { period: String(form.get('period')) } : {}),
      dueOn: String(form.get('dueOn') ?? '')
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    redirect('/admin/agency/billing?error=invoice');
  }
  revalidatePath('/admin/agency/billing');
}
export async function dunningAction() {
  await draftAgencyDunning(await agencyCaller());
  revalidatePath('/admin/agency/billing');
}
export async function simulateInvoiceAction(
  id: string,
  amount: number,
  type: 'invoice.finalized' | 'invoice.paid' | 'invoice.payment_failed'
) {
  await applyAgencyBillingWebhook(await agencyCaller(), {
    id: `evt_dev_${randomUUID()}`,
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    type,
    data: {
      object: {
        id: `in_dev_${id}`,
        livemode: false,
        currency: 'usd',
        amount_due: amount,
        metadata: { agencyInvoiceId: id }
      }
    }
  });
  revalidatePath('/admin/agency/billing');
}
