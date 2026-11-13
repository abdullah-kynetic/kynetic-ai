'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { loadContactAction, saveContactAction } from '@/app/dashboard/contacts/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { CustomFieldInputs } from '@/features/custom-fields/custom-field-inputs';
import {
  customErrorsByKey,
  customFromDrafts,
  draftsFromValues
} from '@/features/custom-fields/inputs';
import { useAppForm } from '@/lib/form';
import type { CustomFieldDef } from '@/server/custom-fields/types';
import { notify } from '@/lib/notify';
import { CONTACT_STATUSES, type DuplicateMatchView } from './types';
import { fullName, STATUS_LABELS } from '../list/format';
import { emptyPanelValues, splitLines, type PanelValues } from './values';

export type PanelTarget = { mode: 'create' } | { mode: 'edit'; id: string } | null;

type Props = {
  target: PanelTarget;
  onClose: () => void;
  owners: { id: string; name: string }[];
  /** The tenant's contact custom field definitions (F-12). */
  customDefs?: readonly CustomFieldDef[];
};

// The server validates everything else; the form only checks the rule that needs no round trip.
const NEEDS_PHONE_OR_EMAIL = 'Enter a phone or an email.';

function validate({ value }: { value: PanelValues }) {
  return splitLines(value.phones).length + splitLines(value.emails).length > 0
    ? undefined
    : { fields: { phones: NEEDS_PHONE_OR_EMAIL } };
}

const REASONS: Record<string, string> = {
  invalid_phone: 'That phone number is not valid.',
  phone_or_email_required: 'Enter a phone or an email.',
  not_a_member: 'That owner is not on your team.'
};

function fieldMessage(reasons: string[]): string {
  return reasons.map((r) => REASONS[r] ?? 'This is not valid.').join(' ');
}

/** Slide-out create and edit panel with a duplicate warning (PRD F-07). */
export function ContactPanel({ target, onClose, owners, customDefs = [] }: Props) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target ? (
        <SheetContent className='w-full overflow-y-auto sm:max-w-md'>
          <PanelBody
            key={target.mode === 'edit' ? target.id : 'new'}
            {...{ target, onClose, owners, customDefs }}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function PanelBody({
  target,
  onClose,
  owners,
  customDefs
}: {
  target: NonNullable<PanelTarget>;
  onClose: () => void;
  owners: Props['owners'];
  customDefs: readonly CustomFieldDef[];
}) {
  const router = useRouter();
  const editId = target.mode === 'edit' ? target.id : undefined;
  const [initial, setInitial] = React.useState<PanelValues | null>(
    editId ? null : emptyPanelValues
  );
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    if (!editId) return;
    let live = true;
    loadContactAction(editId).then(
      (v) => {
        if (!live) return;
        if (v) {
          const { customRaw, ...values } = v;
          setInitial({ ...values, custom: draftsFromValues(customDefs, customRaw) });
        } else setLoadFailed(true);
      },
      () => live && setLoadFailed(true)
    );
    return () => {
      live = false;
    };
  }, [editId, customDefs]);

  const title = editId ? 'Edit contact' : 'Add contact';
  return (
    <>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>
          {editId
            ? 'Change the details and save. The first phone and email on the list are the primary ones.'
            : 'Add a contact by hand. The first phone and email you enter are the primary ones.'}
        </SheetDescription>
      </SheetHeader>
      {loadFailed ? (
        <Alert variant='destructive' className='mx-4'>
          <AlertTitle>Could not open this contact</AlertTitle>
          <AlertDescription>
            It may have been removed. Close the panel and refresh the list.
          </AlertDescription>
        </Alert>
      ) : initial ? (
        <PanelForm
          initial={initial}
          editId={editId}
          owners={owners}
          customDefs={customDefs}
          onDone={() => {
            onClose();
            router.refresh();
          }}
          onClose={onClose}
        />
      ) : (
        <div className='flex justify-center p-8' role='status' aria-label='Loading contact'>
          <Spinner />
        </div>
      )}
    </>
  );
}

function PanelForm({
  initial,
  editId,
  owners,
  customDefs,
  onDone,
  onClose
}: {
  initial: PanelValues;
  editId?: string;
  owners: Props['owners'];
  customDefs: readonly CustomFieldDef[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [duplicates, setDuplicates] = React.useState<DuplicateMatchView[] | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [customErrors, setCustomErrors] = React.useState<Record<string, string[]>>({});

  async function save(values: PanelValues, acknowledgeDuplicates: boolean) {
    setFormError(null);
    setCustomErrors({});
    const res = await saveContactAction({
      id: editId,
      values,
      custom: customDefs.length ? customFromDrafts(customDefs, values.custom) : undefined,
      acknowledgeDuplicates
    });
    if (res.ok) {
      notify.success(editId ? 'Contact saved.' : 'Contact added.');
      onDone();
      return;
    }
    if (res.kind === 'duplicate') {
      setDuplicates(res.matches);
      return;
    }
    if (res.kind === 'invalid') {
      setCustomErrors(customErrorsByKey(res.fieldErrors));
      for (const [path, reasons] of Object.entries(res.fieldErrors)) {
        if (path.startsWith('custom')) continue;
        const name = path.split('.')[0] as keyof PanelValues;
        form.setFieldMeta(name, (m) => ({
          ...m,
          errorMap: {
            ...m.errorMap,
            onSubmit: { message: fieldMessage(reasons) }
          }
        }));
      }
      return;
    }
    setFormError(res.kind === 'not_found' ? 'This contact no longer exists.' : res.message);
  }

  const form = useAppForm({
    defaultValues: initial,
    validators: { onSubmit: validate },
    onSubmit: async ({ value }) => {
      setDuplicates(null);
      await save(value, false);
    }
  });

  return (
    <form
      className='flex min-h-0 flex-1 flex-col'
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className='flex flex-1 flex-col gap-4 overflow-y-auto px-4'>
        {duplicates ? (
          <Alert variant='destructive' role='alert' data-testid='duplicate-warning'>
            <AlertTitle>
              {duplicates.length === 1
                ? 'This looks like a contact you already have'
                : 'This looks like contacts you already have'}
            </AlertTitle>
            <AlertDescription className='flex flex-col gap-2'>
              <ul className='flex flex-col gap-1'>
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/dashboard/contacts/${d.id}`}
                      className='font-medium underline underline-offset-4'
                    >
                      {fullName(d) || 'Unnamed contact'}
                    </Link>{' '}
                    shares {[...d.matchedPhones, ...d.matchedEmails].join(', ')}
                  </li>
                ))}
              </ul>
              <div>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => void save(form.state.values, true)}
                >
                  {editId ? 'Save anyway' : 'Create anyway'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
        {formError ? (
          <Alert variant='destructive' role='alert'>
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <div className='grid grid-cols-2 gap-3'>
          <form.AppField name='firstName'>
            {(f) => <f.TextField label='First name' autoComplete='off' />}
          </form.AppField>
          <form.AppField name='lastName'>
            {(f) => <f.TextField label='Last name' autoComplete='off' />}
          </form.AppField>
        </div>
        <form.AppField name='phones'>
          {(f) => (
            <f.TextareaField
              label='Phones'
              description='One per line. US numbers need no country code.'
              rows={2}
              inputMode='tel'
            />
          )}
        </form.AppField>
        <form.AppField name='emails'>
          {(f) => <f.TextareaField label='Emails' description='One per line.' rows={2} />}
        </form.AppField>
        <form.AppField name='status'>
          {(f) => (
            <f.SelectField
              label='Status'
              options={CONTACT_STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABELS[s]
              }))}
            />
          )}
        </form.AppField>
        <form.AppField name='source'>
          {(f) => <f.TextField label='Source' placeholder='manual' autoComplete='off' />}
        </form.AppField>
        <form.AppField name='ownerId'>
          {(f) => (
            <f.SelectField
              label='Owner'
              placeholder='Unassigned'
              options={[
                { value: '', label: 'Unassigned' },
                ...owners.map((o) => ({ value: o.id, label: o.name }))
              ]}
            />
          )}
        </form.AppField>
        <form.AppField name='tags' mode='array'>
          {(f) => <f.TagsField label='Tags' />}
        </form.AppField>
        <form.Subscribe selector={(s) => s.values.custom}>
          {(custom) => (
            <CustomFieldInputs
              defs={customDefs}
              drafts={custom}
              errors={customErrors}
              onChange={(key, draft) => form.setFieldValue('custom', { ...custom, [key]: draft })}
            />
          )}
        </form.Subscribe>
      </div>
      <SheetFooter className='flex-row justify-end'>
        <Button type='button' variant='outline' onClick={onClose}>
          Cancel
        </Button>
        <form.AppForm>
          <form.SubmitButton>{editId ? 'Save' : 'Add contact'}</form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
