'use client';

import { mergeContactAction } from '@/app/dashboard/contacts/[id]/merge-actions';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import * as React from 'react';

type Candidate = { id: string; name: string; phone: string | null; email: string | null };

export function MergeContactForm({
  survivorId,
  candidates
}: {
  survivorId: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [loserId, setLoserId] = React.useState(candidates[0]?.id ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (!candidates.length)
    return <p className='text-muted-foreground text-sm'>No other live contacts.</p>;

  function merge() {
    setError(null);
    startTransition(async () => {
      const result = await mergeContactAction(survivorId, loserId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-muted-foreground text-sm'>
        Choose a duplicate to merge into this contact. This contact remains the survivor.
      </p>
      <label className='flex flex-col gap-1 text-sm font-medium' htmlFor='merge-contact'>
        Duplicate contact
        <select
          id='merge-contact'
          className='border-input bg-background h-10 rounded-md border px-3 text-sm'
          value={loserId}
          onChange={(event) => setLoserId(event.target.value)}
          disabled={pending}
        >
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} — {candidate.phone ?? candidate.email ?? 'No contact point'}
            </option>
          ))}
        </select>
      </label>
      <Button type='button' onClick={merge} disabled={pending || !loserId}>
        {pending ? 'Merging…' : 'Merge into this contact'}
      </Button>
      {error ? (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  );
}
