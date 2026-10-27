'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconPin, IconPinFilled } from '@tabler/icons-react';
import * as React from 'react';
import { NoteBody } from './note-body';
import { NoteEditor, type Teammate } from './note-editor';

export type NoteItemData = {
  id: string;
  html: string;
  pinned: boolean;
  authorName: string | null;
  createdLabel: string;
  edited: boolean;
  /** The author, or an owner: may edit and delete. Anyone may pin. */
  canEdit: boolean;
};

type Result = { error?: string };

export function NoteItem({
  note,
  teammates,
  pin,
  edit,
  remove
}: {
  note: NoteItemData;
  teammates: Teammate[];
  pin: (id: string, pinned: boolean) => Promise<Result>;
  edit: (id: string, html: string) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
}) {
  const [pending, start] = React.useTransition();
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const act = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
      if (!r.error) after?.();
    });

  return (
    <li className='border-border flex flex-col gap-2 rounded-lg border p-3'>
      <div className='flex items-center gap-2 text-sm'>
        <span className='font-medium'>{note.authorName ?? 'Unknown'}</span>
        <span className='text-muted-foreground'>
          {note.createdLabel}
          {note.edited && ' (edited)'}
        </span>
        {note.pinned && <Badge variant='neutral'>Pinned</Badge>}
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          className='ml-auto'
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          aria-pressed={note.pinned}
          disabled={pending}
          onClick={() => act(() => pin(note.id, !note.pinned))}
        >
          {note.pinned ? <IconPinFilled /> : <IconPin />}
        </Button>
      </div>
      {editing ? (
        <NoteEditor
          teammates={teammates}
          initialHtml={note.html}
          label='Edit note'
          submitLabel='Save'
          pending={pending}
          error={error}
          onCancel={() => setEditing(false)}
          onSubmit={(html) =>
            new Promise<void>((resolve) => {
              act(
                () => edit(note.id, html),
                () => setEditing(false)
              );
              resolve();
            })
          }
        />
      ) : (
        <NoteBody html={note.html} />
      )}
      {!editing && error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      {note.canEdit && !editing && (
        <div className='flex gap-2'>
          <Button type='button' variant='ghost' size='sm' onClick={() => setEditing(true)}>
            Edit
          </Button>
          {confirming ? (
            <>
              <Button
                type='button'
                variant='destructive'
                size='sm'
                disabled={pending}
                onClick={() => act(() => remove(note.id))}
              >
                Delete note
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setConfirming(false)}
              >
                Keep
              </Button>
            </>
          ) : (
            <Button type='button' variant='ghost' size='sm' onClick={() => setConfirming(true)}>
              Delete
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
