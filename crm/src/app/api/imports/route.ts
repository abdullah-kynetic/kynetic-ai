import { NextResponse } from 'next/server';
import { withApi } from '@/server/security/with-api';
import { createImportBatch, IMPORT_MAX_BYTES } from '@/server/imports';
import { AppError } from '@/server/errors';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { isViewingAs } from '@/app/admin/view-as-guard';

export const dynamic = 'force-dynamic';

export const POST = withApi(async (request) => {
  const access = await decideAdminAccess(request.headers);
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    throw new AppError('FORBIDDEN');
  const form = await request.formData();
  const tenantId = String(form.get('tenantId') ?? '');
  const actor = await resolveActor(access.user);
  const ctx = { tenantId, userId: access.user.id, role: 'admin' as const };
  const file = form.get('file');
  if (!(file instanceof File))
    throw new AppError('VALIDATION_FAILED', { message: 'A file is required.' });
  if (file.size > IMPORT_MAX_BYTES)
    throw new AppError('VALIDATION_FAILED', { message: 'File exceeds the 10 MB limit.' });
  const batch = await createImportBatch(
    ctx,
    actor,
    {
      fileName: file.name,
      fileType: file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
      importedSource: String(form.get('importedSource') ?? ''),
      sourceLabel: String(form.get('sourceLabel') ?? '') || undefined,
      mapping: {},
      duplicateRule: 'skip'
    },
    new Uint8Array(await file.arrayBuffer())
  );
  return NextResponse.json({ ok: true, batch }, { status: 201 });
});
