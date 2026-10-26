'use client';

import * as React from 'react';
import { NoteEditor, type Teammate } from './note-editor';

export function NoteComposer({
  teammates,
  save
}: {
  teammates: Teammate[];
  save: (html: string) => Promise<{ error?: string }>;
}) {
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <NoteEditor
      teammates={teammates}
      label='New note'
      submitLabel='Add note'
      pending={pending}
      error={error}
      resetOnSubmit
      onSubmit={(html) =>
        new Promise<void>((resolve) =>
          start(async () => {
            const r = await save(html);
            setError(r.error ?? null);
            resolve();
          })
        )
      }
    />
  );
}
