'use server';

import { createCompany, deleteCompany, updateCompany } from '@/server/companies';
import { NotFoundError } from '@/server/contacts';
import { AppError, type FieldErrors } from '@/server/errors';
import { notFound, redirect } from 'next/navigation';
import { companiesContext } from './_lib/context';

export type CompanyFormState = { error?: string; fieldErrors?: FieldErrors; saved?: boolean };

const text = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
const orNull = (v: string) => (v === '' ? null : v);

/** Form fields to the service input. Blank optional fields clear the value. */
function fromForm(fd: FormData) {
  const address = Object.fromEntries(
    (['line1', 'city', 'state', 'postalCode'] as const)
      .map((k) => [k, text(fd.get(k))] as const)
      .filter(([, v]) => v !== '')
  );
  return {
    name: text(fd.get('name')),
    phone: orNull(text(fd.get('phone'))),
    website: orNull(text(fd.get('website'))),
    address
  };
}

/** Validation and conflict errors go back to the form; anything else is a real failure. */
function toState(e: unknown): CompanyFormState {
  if (e instanceof NotFoundError) notFound();
  if (e instanceof AppError && e.code === 'VALIDATION_FAILED') {
    return { error: e.message, fieldErrors: e.fieldErrors };
  }
  throw e;
}

export async function createCompanyAction(
  _prev: CompanyFormState,
  fd: FormData
): Promise<CompanyFormState> {
  const ctx = await companiesContext();
  let id: string;
  try {
    id = (await createCompany(ctx, fromForm(fd))).id;
  } catch (e) {
    return toState(e);
  }
  redirect(`/dashboard/companies/${id}`);
}

export async function updateCompanyAction(
  id: string,
  _prev: CompanyFormState,
  fd: FormData
): Promise<CompanyFormState> {
  const ctx = await companiesContext();
  try {
    await updateCompany(ctx, id, fromForm(fd));
  } catch (e) {
    return toState(e);
  }
  return { saved: true };
}

export async function deleteCompanyAction(id: string): Promise<void> {
  const ctx = await companiesContext();
  try {
    await deleteCompany(ctx, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  redirect('/dashboard/companies');
}
