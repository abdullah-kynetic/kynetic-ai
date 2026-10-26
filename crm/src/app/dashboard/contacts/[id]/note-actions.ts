'use server';

import { AppError, ValidationError } from '@/server/errors';
import { ModuleDisabledError } from '@/server/modules';
import { createNote, deleteNote, setNotePinned, updateNote } from '@/server/notes';
import { loadShellContext } from '@/server/shell';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Server actions behind the Notes card on the contact page (F-22). Each one rebuilds the caller
// from the session, never from the arguments, then calls the notes service, which checks the
// module, the tenant and who may change the note.

type Result = { error?: string };

async function caller() {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const shell = await loadShellContext(h, c.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) throw new AppError('FORBIDDEN');
  return { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
}

async function guard(contactId: string, fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ModuleDisabledError) return { error: 'Notes are not part of your plan.' };
    if (err instanceof ValidationError) return { error: 'Write something before saving.' };
    if (err instanceof AppError && err.code === 'FORBIDDEN')
      return { error: 'Only the author or an owner can change this note.' };
    if (err instanceof AppError && err.code === 'NOT_FOUND')
      return { error: 'That note no longer exists.' };
    throw err;
  }
  revalidatePath(`/dashboard/contacts/${contactId}`);
  return {};
}

export async function addNote(contactId: string, html: string): Promise<Result> {
  const ctx = await caller();
  return guard(contactId, () => createNote(ctx, { contactId, html }));
}

export async function editNote(contactId: string, id: string, html: string): Promise<Result> {
  const ctx = await caller();
  return guard(contactId, () => updateNote(ctx, id, { html }));
}

export async function pinNote(contactId: string, id: string, pinned: boolean): Promise<Result> {
  const ctx = await caller();
  return guard(contactId, () => setNotePinned(ctx, id, pinned));
}

export async function removeNote(contactId: string, id: string): Promise<Result> {
  const ctx = await caller();
  return guard(contactId, () => deleteNote(ctx, id));
}
