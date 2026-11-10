'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type DocumentRow = { id: string; title: string; kind: string; createdAt: string };

export function DocumentList({
  tenantId,
  documents
}: {
  tenantId: string;
  documents: DocumentRow[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pendingDelete, setPendingDelete] = useState<DocumentRow | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);

  async function remove(document: DocumentRow) {
    setMessage('');
    const response = await fetch(`/api/admin/clients/${tenantId}/documents/${document.id}`, {
      method: 'DELETE'
    });
    const result = (await response.json()) as { ok?: boolean; error?: { message?: string } };
    if (!response.ok || !result.ok) {
      setMessage(result.error?.message ?? 'Delete failed.');
      return;
    }
    setPendingDelete(null);
    setMessage('Document removed from the client view. The stored file is kept.');
    router.refresh();
  }

  async function replace(document: DocumentRow, form: HTMLFormElement) {
    setMessage('');
    const response = await fetch(
      `/api/admin/clients/${tenantId}/documents/${document.id}/replace`,
      { method: 'POST', body: new FormData(form) }
    );
    const result = (await response.json()) as { ok?: boolean; error?: { message?: string } };
    if (!response.ok || !result.ok) {
      setMessage(result.error?.message ?? 'Replace failed.');
      return;
    }
    setReplacing(null);
    setMessage('The client now sees the new PDF. The previous file is kept.');
    router.refresh();
  }

  if (!documents.length) return <p>No current documents.</p>;
  return (
    <div className='mt-8 grid gap-4'>
      <h2 className='text-lg font-semibold'>Current documents</h2>
      {message && (
        <p role='status' aria-live='polite'>
          {message}
        </p>
      )}
      {pendingDelete && (
        <div role='dialog' aria-labelledby='delete-document-title' className='rounded border p-4'>
          <h3 id='delete-document-title' className='font-semibold'>
            Delete {pendingDelete.title}?
          </h3>
          <p>The client will no longer see it. The stored file is kept.</p>
          <div className='mt-3 flex gap-3'>
            <button
              className='min-h-11 rounded border px-4'
              onClick={() => void remove(pendingDelete)}
            >
              Delete document
            </button>
            <button className='min-h-11 rounded border px-4' onClick={() => setPendingDelete(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <ul className='grid gap-3'>
        {documents.map((document) => (
          <li key={document.id} className='rounded border p-3'>
            <p>
              <span className='font-medium'>{document.title}</span>
              <span className='text-muted-foreground'> · {document.kind}</span>
            </p>
            <div className='mt-2 flex flex-wrap gap-3'>
              <button
                className='min-h-11 rounded border px-4'
                onClick={() => setPendingDelete(document)}
              >
                Delete {document.title}
              </button>
              <button
                className='min-h-11 rounded border px-4'
                onClick={() => setReplacing(document.id)}
              >
                Replace {document.title}
              </button>
            </div>
            {replacing === document.id && (
              <form
                className='mt-3 grid gap-2'
                onSubmit={(event) => {
                  event.preventDefault();
                  void replace(document, event.currentTarget);
                }}
              >
                <input type='hidden' name='title' value={document.title} />
                <input type='hidden' name='kind' value={document.kind} />
                <label>
                  Replacement PDF for {document.title}
                  <input name='file' type='file' accept='.pdf,application/pdf' required />
                </label>
                <button className='min-h-11 rounded border px-4'>Upload replacement</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
