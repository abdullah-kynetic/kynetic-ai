'use client';

import { useState } from 'react';

export function DocumentUploadForm({ tenantId }: { tenantId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function upload(form: HTMLFormElement) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/clients/${tenantId}/documents`, { method: 'POST', body: new FormData(form) });
      const result = await response.json() as { ok?: boolean; error?: { message?: string } };
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? 'Upload failed.');
      form.reset();
      setMessage('Document uploaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className='grid max-w-xl gap-4 rounded border p-4' onSubmit={(event) => { event.preventDefault(); void upload(event.currentTarget); }}>
      <label className='grid gap-1'>Title<input name='title' required maxLength={200} className='min-h-11 rounded border px-3' /></label>
      <label className='grid gap-1'>Type<select name='kind' className='min-h-11 rounded border px-3'><option value='agreement'>Agreement</option><option value='proposal'>Proposal</option><option value='invoice'>Invoice</option><option value='report'>Report</option><option value='other'>Other</option></select></label>
      <label className='grid gap-1'>PDF file<input name='file' type='file' accept='.pdf,application/pdf' required className='min-h-11' /></label>
      <button className='min-h-11 rounded border px-4' disabled={busy}>{busy ? 'Uploading…' : 'Upload document'}</button>
      {message && <p role='status' aria-live='polite'>{message}</p>}
    </form>
  );
}
