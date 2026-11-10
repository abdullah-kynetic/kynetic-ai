'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { agencyCaller } from '../caller';
import {
  createAgencyContract,
  markAgencyContractSent,
  markAgencyContractSigned,
  voidAgencyContract
} from '@/server/agency/contracts';
import { AppError } from '@/server/errors';

function fail(error: unknown): never {
  if (!(error instanceof AppError)) throw error;
  redirect('/admin/agency/contracts?error=1');
}

export async function createContractAction(form: FormData) {
  try {
    await createAgencyContract(await agencyCaller(), {
      dealId: String(form.get('dealId') ?? ''),
      title: String(form.get('title') ?? '')
    });
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/contracts');
}
export async function markContractSentAction(id: string, form: FormData) {
  try {
    await markAgencyContractSent(await agencyCaller(), {
      id,
      sentOn: String(form.get('sentOn') ?? '')
    });
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/contracts');
}
export async function markContractSignedAction(id: string, form: FormData) {
  const file = form.get('file');
  const upload =
    file instanceof File && file.size > 0
      ? { name: file.name, body: new Uint8Array(await file.arrayBuffer()) }
      : null;
  try {
    await markAgencyContractSigned(
      await agencyCaller(),
      {
        id,
        signedOn: String(form.get('signedOn') ?? ''),
        notes: String(form.get('notes') ?? '')
      },
      upload
    );
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/contracts');
}
export async function voidContractAction(id: string) {
  try {
    await voidAgencyContract(await agencyCaller(), id);
  } catch (error) {
    fail(error);
  }
  revalidatePath('/admin/agency/contracts');
}
