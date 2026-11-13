'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomFieldInputs } from '@/features/custom-fields/custom-field-inputs';
import {
  customErrorsByKey,
  customFromDrafts,
  draftsFromValues,
  type CustomDrafts
} from '@/features/custom-fields/inputs';
import type { CustomFieldDef } from '@/server/custom-fields/types';
import * as React from 'react';
import type { CompanyFormState } from './actions';

export type CompanyFormValues = {
  name: string;
  phone: string;
  website: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
};

export const EMPTY_COMPANY: CompanyFormValues = {
  name: '',
  phone: '',
  website: '',
  line1: '',
  city: '',
  state: '',
  postalCode: ''
};

// The server sends Zod issue codes, not messages (SECURITY 5.1), so the sentence is chosen per field.
const FIELD_MESSAGES: Partial<Record<keyof CompanyFormValues, string>> = {
  name: 'Enter the company name (up to 200 characters).',
  phone: 'Enter a valid phone number.',
  website: 'Enter a valid website, like example.com.'
};

function fieldError(state: CompanyFormState, field: keyof CompanyFormValues): string | undefined {
  if (!state.fieldErrors?.[field]?.length) return undefined;
  return FIELD_MESSAGES[field] ?? 'Check this value.';
}

type Props = {
  action: (prev: CompanyFormState, fd: FormData) => Promise<CompanyFormState>;
  initial?: CompanyFormValues;
  submitLabel: string;
  /** The tenant's company custom field definitions and this company's stored values (F-12). */
  customDefs?: readonly CustomFieldDef[];
  customValues?: Record<string, unknown>;
};

export function CompanyForm({
  action,
  initial = EMPTY_COMPANY,
  submitLabel,
  customDefs = [],
  customValues = {}
}: Props) {
  const [state, formAction, pending] = React.useActionState<CompanyFormState, FormData>(action, {});
  const id = React.useId();
  const [drafts, setDrafts] = React.useState<CustomDrafts>(() =>
    draftsFromValues(customDefs, customValues)
  );

  const field = (
    name: keyof CompanyFormValues,
    label: string,
    opts: { type?: string; autoComplete?: string; required?: boolean } = {}
  ) => {
    const err = fieldError(state, name);
    return (
      <div className='space-y-1.5'>
        <Label htmlFor={`${id}-${name}`}>{label}</Label>
        <Input
          id={`${id}-${name}`}
          name={name}
          type={opts.type ?? 'text'}
          defaultValue={initial[name]}
          autoComplete={opts.autoComplete}
          required={opts.required}
          aria-invalid={Boolean(err)}
          aria-describedby={err ? `${id}-${name}-err` : undefined}
        />
        {err && (
          <p id={`${id}-${name}-err`} role='alert' className='text-destructive text-sm'>
            {err}
          </p>
        )}
      </div>
    );
  };

  return (
    <form action={formAction} className='space-y-4'>
      {field('name', 'Company name', { required: true, autoComplete: 'organization' })}
      <div className='grid gap-4 sm:grid-cols-2'>
        {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel' })}
        {field('website', 'Website', { type: 'text', autoComplete: 'url' })}
      </div>
      {field('line1', 'Street address', { autoComplete: 'address-line1' })}
      <div className='grid gap-4 sm:grid-cols-3'>
        {field('city', 'City', { autoComplete: 'address-level2' })}
        {field('state', 'State', { autoComplete: 'address-level1' })}
        {field('postalCode', 'ZIP code', { autoComplete: 'postal-code' })}
      </div>
      {customDefs.length > 0 && (
        <input
          type='hidden'
          name='custom'
          value={JSON.stringify(customFromDrafts(customDefs, drafts))}
        />
      )}
      <CustomFieldInputs
        defs={customDefs}
        drafts={drafts}
        errors={customErrorsByKey(state.fieldErrors)}
        onChange={(key, draft) => setDrafts((d) => ({ ...d, [key]: draft }))}
      />
      {state.error && !state.fieldErrors && (
        <p role='alert' className='text-destructive text-sm'>
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role='status' className='text-sm'>
          Saved.
        </p>
      )}
      <Button type='submit' disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
