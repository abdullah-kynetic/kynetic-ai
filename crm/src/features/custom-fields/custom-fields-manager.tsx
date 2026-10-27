'use client';

import * as React from 'react';
import { IconArrowDown, IconArrowUp, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';

import {
  createFieldAction,
  deleteFieldAction,
  reorderFieldsAction,
  updateFieldAction,
  type ActionResult
} from '@/app/dashboard/settings/custom-fields/actions';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/states';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_ENTITY_LABELS,
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_FIELD_TYPES,
  FIELD_KEY_PATTERN,
  isSelectType,
  type CustomFieldDef,
  type CustomFieldEntity,
  type CustomFieldType
} from '@/server/custom-fields/types';

// Settings UI for custom fields (M1-06, F-12, F-43). Slide-out panel for create and edit with the
// unsaved-changes guard (DESIGN_SYSTEM "Slide-out panel"); owners and Kynetic admins edit, others
// read. Every change goes through a server action that re-checks CRM Full and the role.

const ERROR_TEXT: Record<string, string> = {
  invalid_key:
    'Use lower-case letters, numbers and underscores, starting with a letter (2 to 41 characters).',
  key_in_use: 'Another field already uses this key.',
  too_many_fields: 'You have reached the limit of 50 fields.',
  options_required: 'Add at least one option.',
  options_not_allowed: 'Only select fields have options.',
  duplicate: 'Options must be different from each other.',
  too_big: 'This is too long.',
  too_small: 'This is required.'
};
const reason = (r: string) => ERROR_TEXT[r] ?? 'This is not valid.';

type Draft = {
  label: string;
  key: string;
  keyTouched: boolean;
  type: CustomFieldType;
  options: string;
  showInTable: boolean;
  filterable: boolean;
  importable: boolean;
};

const blank: Draft = {
  label: '',
  key: '',
  keyTouched: false,
  type: 'text',
  options: '',
  showInTable: false,
  filterable: false,
  importable: true
};

const draftOf = (d: CustomFieldDef): Draft => ({
  label: d.label,
  key: d.key,
  keyTouched: true,
  type: d.type,
  options: d.options.join('\n'),
  showInTable: d.showInTable,
  filterable: d.filterable,
  importable: d.importable
});

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 41);

const parseOptions = (text: string) =>
  text
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);

function FieldSheet({
  entity,
  editing,
  open,
  onOpenChange
}: {
  entity: CustomFieldEntity;
  editing: CustomFieldDef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(blank);
  const [initial, setInitial] = React.useState<Draft>(blank);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  // Reset when the panel opens for a different field.
  const sheetKey = open ? (editing?.id ?? 'new') : null;
  const [seen, setSeen] = React.useState<string | null>(null);
  if (sheetKey !== seen) {
    setSeen(sheetKey);
    if (sheetKey) {
      const next = editing ? draftOf(editing) : blank;
      setDraft(next);
      setInitial(next);
      setErrors({});
      setFormError(null);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const hasOptions = isSelectType(draft.type);

  function requestClose(next: boolean) {
    if (!next && dirty) setConfirmDiscard(true);
    else onOpenChange(next);
  }

  function validate(): Record<string, string[]> {
    const e: Record<string, string[]> = {};
    if (!draft.label.trim()) e.label = ['too_small'];
    if (!editing && !FIELD_KEY_PATTERN.test(draft.key)) e.key = ['invalid_key'];
    if (hasOptions && parseOptions(draft.options).length === 0) e.options = ['options_required'];
    return e;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const local = validate();
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) {
      document.getElementById(`cf-${Object.keys(local)[0]}`)?.focus();
      return;
    }
    const options = hasOptions ? parseOptions(draft.options) : [];
    startTransition(async () => {
      const result: ActionResult = editing
        ? await updateFieldAction(editing.id, {
            label: draft.label.trim(),
            ...(hasOptions ? { options } : {}),
            showInTable: draft.showInTable,
            filterable: draft.filterable,
            importable: draft.importable
          })
        : await createFieldAction({
            entity,
            key: draft.key,
            label: draft.label.trim(),
            type: draft.type,
            options,
            showInTable: draft.showInTable,
            filterable: draft.filterable,
            importable: draft.importable
          });
      if (result.ok) {
        notify.success(editing ? 'Field saved.' : 'Field added.');
        onOpenChange(false);
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message);
      }
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent className='w-full sm:max-w-[480px]'>
          <form onSubmit={submit} className='flex h-full flex-col gap-4' noValidate>
            <SheetHeader>
              <SheetTitle>{editing ? `Edit ${editing.label}` : 'Add a field'}</SheetTitle>
              <SheetDescription>
                {CUSTOM_FIELD_ENTITY_LABELS[entity]}. The type and key cannot change once the field
                exists.
              </SheetDescription>
            </SheetHeader>
            <div className='flex-1 overflow-y-auto px-4'>
              {formError ? (
                <p role='alert' className='text-destructive mb-3 text-sm'>
                  {formError}
                </p>
              ) : null}
              <FieldGroup>
                <Field data-invalid={Boolean(errors.label)}>
                  <FieldLabel htmlFor='cf-label'>Label *</FieldLabel>
                  <Input
                    id='cf-label'
                    value={draft.label}
                    maxLength={100}
                    aria-invalid={Boolean(errors.label)}
                    onChange={(e) =>
                      set({
                        label: e.target.value,
                        ...(editing || draft.keyTouched ? {} : { key: slug(e.target.value) })
                      })
                    }
                  />
                  {errors.label ? <FieldError>{reason(errors.label[0])}</FieldError> : null}
                </Field>
                <Field data-invalid={Boolean(errors.key)}>
                  <FieldLabel htmlFor='cf-key'>Key *</FieldLabel>
                  <Input
                    id='cf-key'
                    value={draft.key}
                    disabled={Boolean(editing)}
                    aria-invalid={Boolean(errors.key)}
                    onChange={(e) => set({ key: e.target.value, keyTouched: true })}
                  />
                  <FieldDescription>
                    Used by imports and integrations. Example: roof_type.
                  </FieldDescription>
                  {errors.key ? <FieldError>{reason(errors.key[0])}</FieldError> : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor='cf-type'>Type *</FieldLabel>
                  <NativeSelect
                    id='cf-type'
                    className='w-full'
                    value={draft.type}
                    disabled={Boolean(editing)}
                    onChange={(e) => set({ type: e.target.value as CustomFieldType })}
                  >
                    {CUSTOM_FIELD_TYPES.map((t) => (
                      <NativeSelectOption key={t} value={t}>
                        {CUSTOM_FIELD_TYPE_LABELS[t]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {draft.type === 'money' ? (
                    <FieldDescription>Entered in dollars, stored as cents.</FieldDescription>
                  ) : null}
                </Field>
                {hasOptions ? (
                  <Field data-invalid={Boolean(errors.options)}>
                    <FieldLabel htmlFor='cf-options'>Options *</FieldLabel>
                    <Textarea
                      id='cf-options'
                      rows={6}
                      value={draft.options}
                      aria-invalid={Boolean(errors.options)}
                      onChange={(e) => set({ options: e.target.value })}
                    />
                    <FieldDescription>One option per line.</FieldDescription>
                    {errors.options ? <FieldError>{reason(errors.options[0])}</FieldError> : null}
                  </Field>
                ) : null}
                {(
                  [
                    ['showInTable', 'Show in the list', 'Adds a column to the table.'],
                    ['filterable', 'Allow filtering', 'Adds a filter to the table toolbar.'],
                    ['importable', 'Include in imports', 'Lets CSV import map a column to it.']
                  ] as const
                ).map(([name, label, hint]) => (
                  <Field key={name} orientation='horizontal'>
                    <Switch
                      id={`cf-${name}`}
                      checked={draft[name]}
                      onCheckedChange={(v) => set({ [name]: v })}
                    />
                    <div className='flex flex-col'>
                      <FieldLabel htmlFor={`cf-${name}`}>{label}</FieldLabel>
                      <FieldDescription>{hint}</FieldDescription>
                    </div>
                  </Field>
                ))}
              </FieldGroup>
            </div>
            <SheetFooter className='flex-row justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={pending}>
                {pending ? 'Saving' : 'Save'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This field has changes that are not saved.
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

function EntityFields({
  entity,
  defs,
  canEdit
}: {
  entity: CustomFieldEntity;
  defs: CustomFieldDef[];
  canEdit: boolean;
}) {
  const [sheet, setSheet] = React.useState<{ open: boolean; editing: CustomFieldDef | null }>({
    open: false,
    editing: null
  });
  const [toDelete, setToDelete] = React.useState<CustomFieldDef | null>(null);
  const [pending, startTransition] = React.useTransition();

  const run = (fn: () => Promise<ActionResult>, ok?: string) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        if (ok) notify.success(ok);
      } else notify.error(r.message);
    });

  function move(index: number, by: -1 | 1) {
    const ids = defs.map((d) => d.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id);
    run(() => reorderFieldsAction(entity, ids));
  }

  return (
    <div className='flex flex-col gap-4'>
      {canEdit ? (
        <div>
          <Button onClick={() => setSheet({ open: true, editing: null })}>
            <IconPlus aria-hidden='true' />
            Add field
          </Button>
        </div>
      ) : null}
      {defs.length === 0 ? (
        <EmptyState
          title='No custom fields yet'
          description={`Add a field to track something specific to your business on ${CUSTOM_FIELD_ENTITY_LABELS[entity].toLowerCase()}.`}
        />
      ) : (
        <ul
          className='divide-y rounded-lg border'
          aria-label={`${CUSTOM_FIELD_ENTITY_LABELS[entity]} fields`}
        >
          {defs.map((d, i) => (
            <li key={d.id} className='flex flex-wrap items-center gap-3 p-3'>
              <div className='min-w-0 flex-1'>
                <p className='font-medium'>{d.label}</p>
                <p className='text-muted-foreground text-sm'>
                  {CUSTOM_FIELD_TYPE_LABELS[d.type]} · <code>{d.key}</code>
                  {d.options.length ? ` · ${d.options.length} options` : ''}
                </p>
              </div>
              <div className='flex flex-wrap gap-1'>
                {d.showInTable ? <Badge variant='outline'>In list</Badge> : null}
                {d.filterable ? <Badge variant='outline'>Filter</Badge> : null}
                {d.importable ? <Badge variant='outline'>Import</Badge> : null}
              </div>
              {canEdit ? (
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={`Move ${d.label} up`}
                    disabled={pending || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <IconArrowUp aria-hidden='true' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={`Move ${d.label} down`}
                    disabled={pending || i === defs.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <IconArrowDown aria-hidden='true' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={`Edit ${d.label}`}
                    onClick={() => setSheet({ open: true, editing: d })}
                  >
                    <IconPencil aria-hidden='true' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={`Delete ${d.label}`}
                    onClick={() => setToDelete(d)}
                  >
                    <IconTrash aria-hidden='true' />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <FieldSheet
        entity={entity}
        editing={sheet.editing}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The field and every value saved in it are removed from all{' '}
              {CUSTOM_FIELD_ENTITY_LABELS[entity].toLowerCase()}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive-solid'
              onClick={() => {
                const target = toDelete;
                setToDelete(null);
                if (target) run(() => deleteFieldAction(target.id), 'Field deleted.');
              }}
            >
              Delete field
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CustomFieldsManager({
  defs,
  canEdit
}: {
  defs: CustomFieldDef[];
  canEdit: boolean;
}) {
  return (
    <Tabs defaultValue='contact'>
      <TabsList>
        {CUSTOM_FIELD_ENTITIES.map((e) => (
          <TabsTrigger key={e} value={e}>
            {CUSTOM_FIELD_ENTITY_LABELS[e]}
          </TabsTrigger>
        ))}
      </TabsList>
      {CUSTOM_FIELD_ENTITIES.map((e) => (
        <TabsContent key={e} value={e} className='pt-4'>
          <EntityFields entity={e} defs={defs.filter((d) => d.entity === e)} canEdit={canEdit} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
