'use client';

import {
  completeTaskAction,
  deleteTaskAction,
  reopenTaskAction,
  restoreTaskAction
} from '@/app/dashboard/tasks/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/states';
import { notify } from '@/lib/notify';
import type { Assignee, TaskRow } from '@/server/tasks';
import { IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { blankTask, TaskSheet, type TaskDraft } from './task-sheet';

export type TaskGroup = {
  key: string;
  label: string;
  tone?: 'error';
  tasks: TaskRow[];
};

type Props = {
  groups: TaskGroup[];
  assignees: Assignee[];
  timezone: string;
  currentUserId: string;
  /** Pre-links new tasks (the contact page). */
  link?: { contactId?: string; dealId?: string };
  /** Show the contact's name on each row (My Tasks). */
  showContact?: boolean;
  /** Completed rows, shown struck through and not interactive. */
  completed?: TaskRow[];
  emptyTitle?: string;
  emptyDescription?: string;
  /** Hide the Add button (the page header carries it). */
  hideAdd?: boolean;
  /** `YYYY-MM-DDTHH:mm` per task id, computed on the server in the tenant zone. */
  dueLocal: Record<string, string>;
  /** Pre-formatted due text per task id. */
  dueText: Record<string, string>;
};

export function TaskList(props: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<{ draft: TaskDraft; key: number } | null>(null);
  // Optimistic: a ticked task leaves the list at once and comes back if the save fails (F-20).
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string, on: boolean) =>
    setDone((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function complete(t: TaskRow) {
    toggle(t.id, true);
    const res = await completeTaskAction(t.id);
    if (!res.ok) {
      toggle(t.id, false);
      notify.error(res.error.message);
      return;
    }
    router.refresh();
    notify.success('Task completed', {
      action: {
        label: 'Undo',
        onClick: async () => {
          const undo = await reopenTaskAction(t.id);
          if (!undo.ok) return notify.error(undo.error.message);
          toggle(t.id, false);
          router.refresh();
        }
      }
    });
  }

  async function remove(t: TaskRow) {
    toggle(t.id, true);
    const res = await deleteTaskAction(t.id);
    if (!res.ok) {
      toggle(t.id, false);
      notify.error(res.error.message);
      return;
    }
    router.refresh();
    notify.success('Task deleted', {
      action: {
        label: 'Undo',
        onClick: async () => {
          const undo = await restoreTaskAction(t.id);
          if (!undo.ok) return notify.error(undo.error.message);
          toggle(t.id, false);
          router.refresh();
        }
      }
    });
  }

  const edit = (t: TaskRow) =>
    setSheet({
      key: Date.now(),
      draft: {
        id: t.id,
        title: t.title,
        dueLocal: props.dueLocal[t.id] ?? '',
        priority: t.priority as TaskDraft['priority'],
        assigneeId: t.assigneeId ?? ''
      }
    });
  const add = () => setSheet({ key: Date.now(), draft: blankTask(props.currentUserId) });

  const visible = props.groups
    .map((g) => ({ ...g, tasks: g.tasks.filter((t) => !done.has(t.id)) }))
    .filter((g) => g.tasks.length > 0);
  const empty = visible.length === 0 && !props.completed?.length;

  return (
    <div className='flex flex-col gap-6'>
      {!props.hideAdd && (
        <div>
          <Button variant='outline' onClick={add}>
            <IconPlus aria-hidden='true' /> Add task
          </Button>
        </div>
      )}
      {empty && (
        <EmptyState
          title={props.emptyTitle ?? "Nothing due. You're caught up."}
          description={props.emptyDescription ?? 'Add a follow-up so nothing slips.'}
          action={
            <Button onClick={add}>
              <IconPlus aria-hidden='true' /> Add task
            </Button>
          }
        />
      )}
      {visible.map((g) => (
        <section key={g.key} aria-labelledby={`tasks-${g.key}`} className='flex flex-col gap-2'>
          <h3 id={`tasks-${g.key}`} className='flex items-center gap-2 text-sm font-medium'>
            {g.label}
            <Badge variant={g.tone === 'error' ? 'error' : 'neutral'}>{g.tasks.length}</Badge>
          </h3>
          <ul className='divide-y rounded-lg border'>
            {g.tasks.map((t) => (
              <li key={t.id} className='flex items-center gap-3 px-3 py-1'>
                <Checkbox
                  aria-label={`Complete: ${t.title}`}
                  checked={false}
                  onCheckedChange={() => void complete(t)}
                />
                <button
                  type='button'
                  onClick={() => edit(t)}
                  className='hover:bg-muted/50 flex min-h-11 flex-1 flex-col items-start justify-center gap-0.5 rounded-md px-2 text-left'
                >
                  <span className='text-sm font-medium'>{t.title}</span>
                  <span className='text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs'>
                    {g.tone === 'error' ? (
                      <StatusBadge tone='error'>{props.dueText[t.id]}</StatusBadge>
                    ) : (
                      <span>{props.dueText[t.id] ?? 'No due date'}</span>
                    )}
                    {t.priority === 'high' && <Badge variant='warning'>High priority</Badge>}
                    {props.showContact && t.contactName && <span>{t.contactName}</span>}
                    {t.assigneeName && t.assigneeId !== props.currentUserId && (
                      <span>{t.assigneeName}</span>
                    )}
                  </span>
                </button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground'
                  onClick={() => void remove(t)}
                  aria-label={`Delete: ${t.title}`}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {props.completed && props.completed.length > 0 && (
        <section aria-labelledby='tasks-completed' className='flex flex-col gap-2'>
          <h3 id='tasks-completed' className='text-muted-foreground text-sm font-medium'>
            Recently completed
          </h3>
          <ul className='text-muted-foreground flex flex-col gap-1 text-sm'>
            {props.completed.map((t) => (
              <li key={t.id} className='line-through'>
                {t.title}
              </li>
            ))}
          </ul>
        </section>
      )}
      {sheet && (
        <TaskSheet
          key={sheet.key}
          open
          onOpenChange={(o) => !o && setSheet(null)}
          draft={sheet.draft}
          assignees={props.assignees}
          timezone={props.timezone}
          link={props.link}
        />
      )}
    </div>
  );
}
