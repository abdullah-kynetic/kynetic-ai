'use client';

import { saveTaskAction, type SaveTaskInput } from '@/app/dashboard/tasks/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { notify } from '@/lib/notify';
import type { Assignee, TaskPriority } from '@/server/tasks';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export type TaskDraft = {
  id?: string;
  title: string;
  /** `YYYY-MM-DDTHH:mm` in the tenant zone. */
  dueLocal: string;
  priority: TaskPriority;
  assigneeId: string;
};

export const blankTask = (assigneeId: string): TaskDraft => ({
  title: '',
  dueLocal: '',
  priority: 'normal',
  assigneeId
});

const ERROR_TEXT: Record<string, string> = {
  too_small: 'Enter a title.',
  too_big: 'This is too long.',
  not_a_member: 'Pick someone on your team.',
  invalid_date: 'Enter a valid date and time.'
};

/** The task slide-out (F-20): add or edit. `link` pins a new task to a contact or deal. */
export function TaskSheet({
  open,
  onOpenChange,
  draft,
  assignees,
  timezone,
  link
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: TaskDraft;
  assignees: Assignee[];
  timezone: string;
  link?: { contactId?: string; dealId?: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const editing = Boolean(draft.id);
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) =>
    setValues((cur) => ({ ...cur, [k]: v }));
  const fieldError = (k: string) => errors[k]?.map((r) => ERROR_TEXT[r] ?? 'Check this field.')[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const input: SaveTaskInput = { ...values, ...link };
    start(async () => {
      const res = await saveTaskAction(input);
      if (res.ok) {
        notify.success(editing ? 'Task updated' : 'Task added');
        onOpenChange(false);
        router.refresh();
        return;
      }
      setErrors(res.error.fieldErrors ?? {});
      setFormError(res.error.fieldErrors ? null : res.error.message);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full sm:max-w-md'>
        <form onSubmit={submit} className='flex h-full flex-col' noValidate>
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit task' : 'Add task'}</SheetTitle>
            <SheetDescription>Times are in your business time zone ({timezone}).</SheetDescription>
          </SheetHeader>
          <div className='flex flex-col gap-4 px-4'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='task-title'>Title</Label>
              <Input
                id='task-title'
                value={values.title}
                onChange={(e) => set('title', e.target.value)}
                aria-invalid={Boolean(fieldError('title'))}
                aria-describedby='task-title-error'
                autoFocus
                required
              />
              <p id='task-title-error' className='text-destructive text-sm' role='alert'>
                {fieldError('title')}
              </p>
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='task-due'>Due</Label>
              <Input
                id='task-due'
                type='datetime-local'
                value={values.dueLocal}
                onChange={(e) => set('dueLocal', e.target.value)}
                aria-invalid={Boolean(fieldError('dueAt'))}
                aria-describedby='task-due-error'
              />
              <p id='task-due-error' className='text-destructive text-sm' role='alert'>
                {fieldError('dueAt')}
              </p>
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='task-priority'>Priority</Label>
              <NativeSelect
                id='task-priority'
                className='w-full'
                value={values.priority}
                onChange={(e) => set('priority', e.target.value as TaskPriority)}
              >
                <NativeSelectOption value='low'>Low</NativeSelectOption>
                <NativeSelectOption value='normal'>Normal</NativeSelectOption>
                <NativeSelectOption value='high'>High</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='task-assignee'>Assigned to</Label>
              <NativeSelect
                id='task-assignee'
                className='w-full'
                value={values.assigneeId}
                onChange={(e) => set('assigneeId', e.target.value)}
              >
                <NativeSelectOption value=''>Unassigned</NativeSelectOption>
                {assignees.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <p className='text-destructive text-sm' role='alert'>
                {fieldError('assigneeId')}
              </p>
            </div>
            {formError && (
              <p className='text-destructive text-sm' role='alert'>
                {formError}
              </p>
            )}
          </div>
          <SheetFooter>
            <Button type='submit' disabled={pending}>
              {pending ? 'Saving…' : editing ? 'Save task' : 'Add task'}
            </Button>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
