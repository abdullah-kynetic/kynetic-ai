'use client';

import { saveDeal } from '@/app/dashboard/deals/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { CustomFieldInputs } from '@/features/custom-fields/custom-field-inputs';
import {
  customErrorsByKey,
  customFromDrafts,
  draftsFromValues,
  type CustomDrafts
} from '@/features/custom-fields/inputs';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { CustomFieldDef } from '@/server/custom-fields/types';
import { centsToInput, type DealFormInput } from '@/server/deals/form';
import { IconPencil } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

export type DealPanelDeal = {
  id: string;
  title: string;
  valueCents: number;
  serviceType: string | null;
  expectedClose: string | null;
  source: string | null;
  ownerId: string | null;
  stageId: string;
  lostReason: string | null;
  /** Stored custom field values (F-12). */
  custom?: Record<string, unknown>;
};

export type DealPanelStage = { id: string; name: string; isLost: boolean };
export type DealPanelMember = { id: string; label: string };

const FIELD_MESSAGES: Record<string, string> = {
  'title:required': 'Give the deal a title.',
  'valueCents:invalid': 'Enter an amount like 12,500 or 12,500.50.',
  'lostReason:required': 'Say why the deal was lost.',
  'ownerId:not_a_member': 'Pick someone on your team.',
  'stageId:required': 'Pick a stage.'
};

const fieldError = (errors: Record<string, string[]>, field: string) => {
  const code = errors[field]?.[0];
  if (!code) return undefined;
  return FIELD_MESSAGES[`${field}:${code}`] ?? 'Check this field.';
};

function toForm(deal: DealPanelDeal): DealFormInput {
  return {
    title: deal.title,
    value: centsToInput(deal.valueCents),
    serviceType: deal.serviceType ?? '',
    expectedClose: deal.expectedClose ?? '',
    source: deal.source ?? '',
    ownerId: deal.ownerId ?? '',
    stageId: deal.stageId,
    lostReason: deal.lostReason ?? ''
  };
}

/**
 * The deal slide-out (F-14): right side, 480px on desktop and full screen on mobile (DESIGN_SYSTEM
 * "Dialog, slide-out panel and confirm"). Closing with unsaved edits asks first. The kanban card
 * (M2-02) opens the same panel.
 */
export function DealPanel({
  deal,
  stages,
  members,
  customDefs = [],
  open,
  onOpenChange
}: {
  deal: DealPanelDeal;
  stages: DealPanelStage[];
  members: DealPanelMember[];
  /** The tenant's deal custom field definitions (F-12). */
  customDefs?: readonly CustomFieldDef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formId = React.useId();
  const initial = React.useMemo(() => toForm(deal), [deal]);
  const initialCustom = React.useMemo(
    () => draftsFromValues(customDefs, deal.custom ?? {}),
    [customDefs, deal.custom]
  );
  const [form, setForm] = React.useState<DealFormInput>(initial);
  const [custom, setCustom] = React.useState<CustomDrafts>(initialCustom);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, startTransition] = React.useTransition();
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  // A fresh open starts from the saved deal, not from an abandoned edit. Adjusted during render
  // (not in an effect) so the form never paints stale values.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(initial);
      setCustom(initialCustom);
      setErrors({});
    }
  }

  const dirty =
    (Object.keys(initial) as (keyof DealFormInput)[]).some((k) => form[k] !== initial[k]) ||
    JSON.stringify(customFromDrafts(customDefs, custom)) !==
      JSON.stringify(customFromDrafts(customDefs, initialCustom));
  const toLost = stages.find((s) => s.id === form.stageId)?.isLost ?? false;
  const set = (key: keyof DealFormInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const requestClose = (next: boolean) => {
    if (!next && dirty && !pending) setConfirmDiscard(true);
    else onOpenChange(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveDeal(
        deal.id,
        form,
        customDefs.length ? customFromDrafts(customDefs, custom) : undefined
      );
      if (result.ok) {
        toast.success('Deal saved');
        onOpenChange(false);
        router.refresh();
        return;
      }
      setErrors(result.fieldErrors ?? {});
      if (!result.fieldErrors) toast.error(result.message);
    });
  };

  const text = (
    key: keyof DealFormInput,
    label: string,
    props: React.ComponentProps<typeof Input> = {}
  ) => {
    const message = fieldError(errors, key === 'value' ? 'valueCents' : key);
    return (
      <Field data-invalid={Boolean(message)}>
        <FieldLabel htmlFor={`${formId}-${key}`}>{label}</FieldLabel>
        <Input
          id={`${formId}-${key}`}
          value={form[key]}
          onChange={(e) => set(key)(e.target.value)}
          aria-invalid={Boolean(message)}
          aria-describedby={message ? `${formId}-${key}-error` : undefined}
          {...props}
        />
        {message && <FieldError id={`${formId}-${key}-error`}>{message}</FieldError>}
      </Field>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent className='data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]'>
          <SheetHeader>
            <SheetTitle>Edit deal</SheetTitle>
            <SheetDescription>Changes save to the deal and show on the board.</SheetDescription>
          </SheetHeader>
          <form id={formId} onSubmit={submit} className='flex-1 overflow-y-auto px-4' noValidate>
            <FieldGroup>
              {text('title', 'Title', { required: true, maxLength: 200 })}
              {text('value', 'Value (USD)', { inputMode: 'decimal', placeholder: '12,500' })}
              <Field data-invalid={Boolean(fieldError(errors, 'stageId'))}>
                <FieldLabel htmlFor={`${formId}-stageId`}>Stage</FieldLabel>
                <NativeSelect
                  className='w-full'
                  id={`${formId}-stageId`}
                  value={form.stageId}
                  onChange={(e) => set('stageId')(e.target.value)}
                >
                  {stages.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {toLost && (
                <Field data-invalid={Boolean(fieldError(errors, 'lostReason'))}>
                  <FieldLabel htmlFor={`${formId}-lostReason`}>Lost reason *</FieldLabel>
                  <Textarea
                    id={`${formId}-lostReason`}
                    value={form.lostReason}
                    onChange={(e) => set('lostReason')(e.target.value)}
                    maxLength={500}
                    required
                    aria-invalid={Boolean(fieldError(errors, 'lostReason'))}
                    aria-describedby={`${formId}-lostReason-error`}
                  />
                  {fieldError(errors, 'lostReason') && (
                    <FieldError id={`${formId}-lostReason-error`}>
                      {fieldError(errors, 'lostReason')}
                    </FieldError>
                  )}
                </Field>
              )}
              {text('serviceType', 'Service type', { maxLength: 100 })}
              {text('expectedClose', 'Expected close', { type: 'date' })}
              {text('source', 'Lead source', { maxLength: 100 })}
              <Field data-invalid={Boolean(fieldError(errors, 'ownerId'))}>
                <FieldLabel htmlFor={`${formId}-ownerId`}>Owner</FieldLabel>
                <NativeSelect
                  className='w-full'
                  id={`${formId}-ownerId`}
                  value={form.ownerId}
                  onChange={(e) => set('ownerId')(e.target.value)}
                >
                  <NativeSelectOption value=''>Unassigned</NativeSelectOption>
                  {members.map((m) => (
                    <NativeSelectOption key={m.id} value={m.id}>
                      {m.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {fieldError(errors, 'ownerId') && (
                  <FieldError>{fieldError(errors, 'ownerId')}</FieldError>
                )}
              </Field>
              <CustomFieldInputs
                defs={customDefs}
                drafts={custom}
                errors={customErrorsByKey(errors)}
                onChange={(key, draft) => setCustom((c) => ({ ...c, [key]: draft }))}
              />
            </FieldGroup>
          </form>
          <SheetFooter className='flex-row justify-end gap-2'>
            <Button type='button' variant='outline' onClick={() => requestClose(false)}>
              Cancel
            </Button>
            <LoadingButton type='submit' form={formId} loading={pending}>
              Save deal
            </LoadingButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have edits that are not saved. They will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** The page's Edit button and the panel it opens. */
export function EditDealButton(
  props: Omit<React.ComponentProps<typeof DealPanel>, 'open' | 'onOpenChange'>
) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant='outline' onClick={() => setOpen(true)}>
        <IconPencil aria-hidden /> Edit
      </Button>
      <DealPanel {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}
