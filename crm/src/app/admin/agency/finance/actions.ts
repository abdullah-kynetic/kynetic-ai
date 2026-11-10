'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dollarsToCents } from '@/server/agency/billing-policy';
import {
  addAgencyExpense,
  addAgencyReferral,
  addAgencyRevenue,
  approveAgencyReferral,
  deleteAgencyExpense,
  editAgencyExpense,
  saveAgencyCaseStudy
} from '@/server/agency/finance';
import { AppError } from '@/server/errors';
import { agencyCaller } from '../caller';

function fail(error: unknown): never {
  if (
    !(error instanceof AppError) &&
    !(error instanceof Error && error.message.startsWith('Enter a USD'))
  )
    throw error;
  redirect('/admin/agency/finance?error=1');
}

export async function addExpenseAction(form: FormData) {
  try {
    await addAgencyExpense(await agencyCaller(), {
      spentOn: String(form.get('spentOn') ?? ''),
      vendor: String(form.get('vendor') ?? ''),
      category: String(form.get('category') ?? ''),
      amountCents: dollarsToCents(String(form.get('amount') ?? '')),
      note: String(form.get('note') ?? '')
    });
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/finance');
  revalidatePath('/admin/agency');
}
export async function editExpenseAction(id: string, form: FormData) {
  try {
    await editAgencyExpense(await agencyCaller(), {
      id,
      spentOn: String(form.get('spentOn') ?? ''),
      vendor: String(form.get('vendor') ?? ''),
      category: String(form.get('category') ?? ''),
      amountCents: dollarsToCents(String(form.get('amount') ?? '')),
      note: String(form.get('note') ?? '')
    });
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/finance');
  revalidatePath('/admin/agency');
}
export async function deleteExpenseAction(id: string) {
  await deleteAgencyExpense(await agencyCaller(), id);
  revalidatePath('/admin/agency/finance');
  revalidatePath('/admin/agency');
}
export async function addRevenueAction(form: FormData) {
  try {
    await addAgencyRevenue(await agencyCaller(), {
      receivedOn: String(form.get('receivedOn') ?? ''),
      amountCents: dollarsToCents(String(form.get('amount') ?? '')),
      note: String(form.get('note') ?? '')
    });
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/finance');
  revalidatePath('/admin/agency');
}
export async function addReferralAction(form: FormData) {
  const contactId = String(form.get('contactId') ?? '');
  try {
    await addAgencyReferral(await agencyCaller(), {
      referrerName: String(form.get('referrerName') ?? ''),
      ...(contactId ? { contactId } : {}),
      rewardNote: String(form.get('rewardNote') ?? '')
    });
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/finance');
}
export async function approveReferralAction(id: string) {
  await approveAgencyReferral(await agencyCaller(), id);
  revalidatePath('/admin/agency/finance');
}
export async function saveCaseStudyAction(form: FormData) {
  const id = String(form.get('id') ?? '');
  const clientTenantId = String(form.get('clientTenantId') ?? '');
  try {
    await saveAgencyCaseStudy(await agencyCaller(), {
      ...(id ? { id } : {}),
      ...(clientTenantId ? { clientTenantId } : {}),
      status: String(form.get('status') ?? 'idea'),
      url: String(form.get('url') ?? ''),
      note: String(form.get('note') ?? '')
    });
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/finance');
}
