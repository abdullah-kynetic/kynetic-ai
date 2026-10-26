'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

type TagRow = { name: string; contactCount: number; registered: boolean };

const API = '/api/settings/tags';

/** Tag list with add, rename and delete. Deleting asks first because it edits every contact with the tag. */
export function TagsManager({ initial, canEdit }: { initial: TagRow[]; canEdit: boolean }) {
  const [tags, setTags] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(method: string, payload: unknown, done: string): Promise<boolean> {
    setBusy(true);
    setStatus(null);
    const res = await fetch(API, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const fields = body.error?.fieldErrors as Record<string, string[]> | undefined;
      setStatus({
        ok: false,
        text: fields?.name?.includes('duplicate')
          ? 'That tag already exists.'
          : (body.error?.message ?? 'Could not save.')
      });
      return false;
    }
    setTags(body.tags);
    setDrafts({});
    setDeleting(null);
    setStatus({ ok: true, text: done });
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call('POST', { name: newName }, 'Tag added.')) setNewName('');
  }

  return (
    <div className='max-w-2xl space-y-6'>
      {tags.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No tags yet.</p>
      ) : (
        <ul className='space-y-3' aria-label='Tags'>
          {tags.map((t) => {
            const draft = drafts[t.name] ?? t.name;
            return (
              <li key={t.name} className='bg-card space-y-3 rounded-lg border p-3'>
                <div className='flex flex-wrap items-end gap-3'>
                  <div className='min-w-48 flex-1 space-y-1'>
                    <Label htmlFor={`tag-${t.name}`}>Tag name</Label>
                    <Input
                      id={`tag-${t.name}`}
                      value={draft}
                      maxLength={50}
                      disabled={!canEdit || busy}
                      onChange={(e) => setDrafts((d) => ({ ...d, [t.name]: e.target.value }))}
                    />
                  </div>
                  <span className='text-muted-foreground pb-3 text-sm'>
                    {t.contactCount} {t.contactCount === 1 ? 'contact' : 'contacts'}
                  </span>
                  {canEdit && (
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        variant='secondary'
                        disabled={busy || draft.trim() === '' || draft.trim() === t.name}
                        onClick={() =>
                          call('PATCH', { from: t.name, to: draft }, `Renamed to ${draft.trim()}.`)
                        }
                      >
                        Save name
                      </Button>
                      <Button
                        type='button'
                        variant='destructive'
                        disabled={busy}
                        onClick={() => setDeleting(deleting === t.name ? null : t.name)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                {deleting === t.name && (
                  <div
                    className='space-y-2 border-t pt-3'
                    role='group'
                    aria-label={`Delete ${t.name}`}
                  >
                    <p className='text-sm'>
                      {t.contactCount > 0
                        ? `This removes the tag from ${t.contactCount} ${t.contactCount === 1 ? 'contact' : 'contacts'}. The contacts stay.`
                        : 'No contact has this tag. Delete it?'}
                    </p>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        variant='destructive-solid'
                        disabled={busy}
                        onClick={() => call('DELETE', { name: t.name }, 'Tag deleted.')}
                      >
                        Delete tag
                      </Button>
                      <Button type='button' variant='outline' onClick={() => setDeleting(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit ? (
        <form onSubmit={add} className='flex flex-wrap items-end gap-3'>
          <div className='min-w-48 flex-1 space-y-1'>
            <Label htmlFor='new-tag'>New tag</Label>
            <Input
              id='new-tag'
              value={newName}
              maxLength={50}
              disabled={busy}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button type='submit' disabled={busy || newName.trim() === ''}>
            Add tag
          </Button>
        </form>
      ) : (
        <p className='text-muted-foreground text-sm'>Only the owner can change tags.</p>
      )}

      <p role='status' className={status?.ok === false ? 'text-destructive text-sm' : 'text-sm'}>
        {status?.text}
      </p>
    </div>
  );
}
