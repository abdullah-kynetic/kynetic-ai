'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

/** Owner and source filters above the board (F-16). The choice lives in the URL so a link shares the view. */
export function BoardFilterBar({
  owners,
  sources,
  ownerId,
  source
}: {
  owners: { id: string; name: string }[];
  sources: string[];
  ownerId?: string;
  source?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (key: 'owner' | 'source', value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <form
      role='search'
      aria-label='Filter deals'
      className='flex flex-wrap items-center gap-3 pb-3'
      onSubmit={(e) => e.preventDefault()}
    >
      <label className='flex items-center gap-2 text-sm'>
        <span className='text-muted-foreground'>Owner</span>
        <NativeSelect value={ownerId ?? ''} onChange={(e) => set('owner', e.target.value)}>
          <option value=''>Everyone</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className='flex items-center gap-2 text-sm'>
        <span className='text-muted-foreground'>Source</span>
        <NativeSelect value={source ?? ''} onChange={(e) => set('source', e.target.value)}>
          <option value=''>All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </label>
      {ownerId || source ? (
        <Button type='button' variant='ghost' size='sm' onClick={() => router.replace(pathname)}>
          Clear filters
        </Button>
      ) : null}
    </form>
  );
}
