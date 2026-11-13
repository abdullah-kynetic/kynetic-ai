'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { CustomFieldDef } from '@/server/custom-fields/types';
import { customFieldMessage, type CustomDraft, type CustomDrafts } from './inputs';

/**
 * Inputs for a record's custom fields (F-12): the tenant's own labels, one input per type, in
 * definition order. Controlled: the parent keeps the drafts and turns them into the stored values
 * with `customFromDrafts` when it saves. Renders nothing when the tenant has no definitions for
 * this kind of record. `errors` are the server's reasons keyed by field key.
 */
export function CustomFieldInputs({
  defs,
  drafts,
  onChange,
  errors = {},
  heading = 'Custom fields'
}: {
  defs: readonly CustomFieldDef[];
  drafts: CustomDrafts;
  onChange: (key: string, draft: CustomDraft) => void;
  errors?: Record<string, string[]>;
  heading?: string;
}) {
  const base = React.useId();
  if (defs.length === 0) return null;
  return (
    <fieldset className='flex flex-col gap-4' data-testid='custom-field-inputs'>
      <legend className='mb-1 text-sm font-medium'>{heading}</legend>
      {defs.map((d) => {
        const id = `${base}-${d.key}`;
        const reasons = errors[d.key];
        const message = reasons?.length ? customFieldMessage(d, reasons) : undefined;
        const draft = drafts[d.key];
        const described = message ? `${id}-error` : undefined;
        return (
          <div key={d.id} className='flex flex-col gap-1.5'>
            {d.type === 'checkbox' ? (
              <label htmlFor={id} className='flex items-center gap-2 text-sm'>
                <input
                  id={id}
                  type='checkbox'
                  className='size-4 accent-current'
                  checked={draft === true}
                  aria-invalid={Boolean(message)}
                  aria-describedby={described}
                  onChange={(e) => onChange(d.key, e.target.checked)}
                />
                {d.label}
              </label>
            ) : d.type === 'multi_select' ? (
              <fieldset aria-describedby={described} className='flex flex-col gap-1.5'>
                <legend className='text-sm'>{d.label}</legend>
                <div className='flex flex-wrap gap-x-4 gap-y-1'>
                  {d.options.map((o) => {
                    const chosen = Array.isArray(draft) ? draft : [];
                    return (
                      <label key={o} className='flex items-center gap-2 text-sm'>
                        <input
                          type='checkbox'
                          className='size-4 accent-current'
                          checked={chosen.includes(o)}
                          onChange={(e) =>
                            onChange(
                              d.key,
                              e.target.checked ? [...chosen, o] : chosen.filter((c) => c !== o)
                            )
                          }
                        />
                        {o}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <>
                <label htmlFor={id} className='text-sm'>
                  {d.label}
                </label>
                {d.type === 'select' ? (
                  <NativeSelect
                    className='w-full'
                    id={id}
                    value={typeof draft === 'string' ? draft : ''}
                    aria-invalid={Boolean(message)}
                    aria-describedby={described}
                    onChange={(e) => onChange(d.key, e.target.value)}
                  >
                    <NativeSelectOption value=''>Not set</NativeSelectOption>
                    {d.options.map((o) => (
                      <NativeSelectOption key={o} value={o}>
                        {o}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id={id}
                    type={d.type === 'date' ? 'date' : 'text'}
                    inputMode={
                      d.type === 'number' ? 'decimal' : d.type === 'money' ? 'decimal' : undefined
                    }
                    placeholder={d.type === 'money' ? '12,500' : undefined}
                    autoComplete='off'
                    value={typeof draft === 'string' ? draft : ''}
                    aria-invalid={Boolean(message)}
                    aria-describedby={described}
                    onChange={(e) => onChange(d.key, e.target.value)}
                  />
                )}
              </>
            )}
            {message ? (
              <p id={`${id}-error`} role='alert' className='text-destructive text-sm'>
                {message}
              </p>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
