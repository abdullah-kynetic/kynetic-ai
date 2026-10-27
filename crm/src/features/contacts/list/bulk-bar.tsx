'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { bulkContactsAction } from '@/app/dashboard/contacts/actions';
import type { BulkAction, BulkCapabilities } from '@/server/contacts';
import { CONTACT_STATUSES, type ContactStatus } from '@/server/contacts/constants';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { NativeSelect } from '@/components/ui/native-select';
import { notify } from '@/lib/notify';
import { STATUS_LABELS } from './format';

type Owner = { id: string; name: string };
type Panel = 'tag' | 'owner' | 'status' | 'delete' | null;

type Props = {
  ids: string[];
  owners: Owner[];
  caps: BulkCapabilities;
  /** Called after a successful action so the table can clear its selection. */
  onDone: () => void;
};

const plural = (n: number) => (n === 1 ? '1 contact' : `${n.toLocaleString('en-US')} contacts`);
const splitTags = (v: string) =>
  v
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * The sticky bottom bar for bulk actions (F-08, DESIGN_SYSTEM mobile rules). The server decides
 * what is allowed; `caps` only decides what is shown. Delete always confirms with the count.
 */
export function BulkBar({ ids, owners, caps, onDone }: Props) {
  const router = useRouter();
  const [panel, setPanel] = React.useState<Panel>(null);
  const [pending, startTransition] = React.useTransition();
  const [addTags, setAddTags] = React.useState('');
  const [removeTags, setRemoveTags] = React.useState('');
  const [owner, setOwner] = React.useState('');
  const [status, setStatus] = React.useState<ContactStatus>('working');

  function run(action: BulkAction, done: string) {
    startTransition(async () => {
      const res = await bulkContactsAction({ ids, action });
      if (!res.ok) {
        notify.error(res.error.message);
        return;
      }
      notify.success(done);
      setPanel(null);
      setAddTags('');
      setRemoveTags('');
      onDone();
      router.refresh();
    });
  }

  const n = plural(ids.length);
  const tagsReady = splitTags(addTags).length + splitTags(removeTags).length > 0;

  return (
    <>
      <div
        role='region'
        aria-label='Bulk actions'
        className='bg-card sticky bottom-0 z-40 flex flex-wrap items-center gap-2 rounded-lg border p-3 shadow-sm'
      >
        <span className='me-auto text-sm font-medium tabular-nums' role='status'>
          {ids.length.toLocaleString('en-US')} selected
        </span>
        <Button variant='outline' onClick={() => setPanel('tag')}>
          Tags
        </Button>
        <Button variant='outline' onClick={() => setPanel('owner')}>
          Assign owner
        </Button>
        <Button variant='outline' onClick={() => setPanel('status')}>
          Change status
        </Button>
        {caps.enroll ? (
          <Button variant='outline' disabled title='Available when sequences ship'>
            Enrol in sequence
          </Button>
        ) : null}
        {caps.delete ? (
          <Button variant='destructive' onClick={() => setPanel('delete')}>
            Delete
          </Button>
        ) : null}
      </div>

      <Dialog open={panel === 'tag'} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tags for {n}</DialogTitle>
            <DialogDescription>Separate tags with commas. Case does not matter.</DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='bulk-add-tags'>Add tags</Label>
              <Input
                id='bulk-add-tags'
                value={addTags}
                onChange={(e) => setAddTags(e.target.value)}
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='bulk-remove-tags'>Remove tags</Label>
              <Input
                id='bulk-remove-tags'
                value={removeTags}
                onChange={(e) => setRemoveTags(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <LoadingButton
              loading={pending}
              disabled={!tagsReady}
              onClick={() =>
                run(
                  { type: 'tag', add: splitTags(addTags), remove: splitTags(removeTags) },
                  `Tags updated on ${n}.`
                )
              }
            >
              Apply
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={panel === 'owner'} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign owner to {n}</DialogTitle>
            <DialogDescription>Replaces the current owner on every selected row.</DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='bulk-owner'>Owner</Label>
            <NativeSelect
              id='bulk-owner'
              className='w-full'
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value='' disabled>
                Choose an owner
              </option>
              <option value='none'>Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <LoadingButton
              loading={pending}
              disabled={!owner}
              onClick={() =>
                run(
                  { type: 'owner', ownerId: owner === 'none' ? null : owner },
                  `Owner updated on ${n}.`
                )
              }
            >
              Apply
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={panel === 'status'} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status for {n}</DialogTitle>
            <DialogDescription>Sets the same status on every selected row.</DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='bulk-status'>Status</Label>
            <NativeSelect
              id='bulk-status'
              className='w-full'
              value={status}
              onChange={(e) => setStatus(e.target.value as ContactStatus)}
            >
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <LoadingButton
              loading={pending}
              onClick={() => run({ type: 'status', status }, `Status updated on ${n}.`)}
            >
              Apply
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={panel === 'delete'} onOpenChange={(o) => !o && setPanel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {n}?</AlertDialogTitle>
            <AlertDialogDescription>
              They leave your lists and cannot be found in search. Their history and consent records
              are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive-solid'
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                run({ type: 'delete' }, `${n} deleted.`);
              }}
            >
              Delete {n}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
