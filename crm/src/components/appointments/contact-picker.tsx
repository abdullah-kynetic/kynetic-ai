'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchAppointmentContacts } from '@/app/dashboard/appointments/actions';
import * as React from 'react';

type Hit = { id: string; name: string; phone: string | null };

/** Searchable contact field. The hidden input is what the booking form submits. */
export function ContactPicker() {
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [picked, setPicked] = React.useState<Hit | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const request = React.useRef(0);

  async function onChange(value: string) {
    setQuery(value);
    setPicked(null);
    const current = ++request.current;
    if (value.trim().length < 2) {
      setHits([]);
      setMessage(null);
      return;
    }
    const result = await searchAppointmentContacts(value);
    if (current !== request.current) return;
    if (!result.ok) {
      setHits([]);
      setMessage(result.error);
      return;
    }
    setHits(result.results);
    setMessage(result.results.length === 0 ? 'No matching contacts.' : null);
  }

  return (
    <div className='grid gap-2'>
      <label htmlFor='appointment-contact' className='text-sm font-medium'>
        Contact
      </label>
      <Input
        id='appointment-contact'
        value={picked ? picked.name : query}
        onChange={(event) => onChange(event.target.value)}
        placeholder='Search by name'
        autoComplete='off'
      />
      <input type='hidden' name='contactId' value={picked?.id ?? ''} />
      {message ? (
        <p className='text-muted-foreground text-sm' role='status'>
          {message}
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul aria-label='Matching contacts' className='grid gap-1'>
          {hits.map((hit) => (
            <li key={hit.id}>
              <Button
                type='button'
                variant='outline'
                className='w-full justify-start'
                onClick={() => {
                  setPicked(hit);
                  setHits([]);
                  setMessage(null);
                }}
              >
                {hit.name}
                {hit.phone ? <span className='text-muted-foreground ms-2'>{hit.phone}</span> : null}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
