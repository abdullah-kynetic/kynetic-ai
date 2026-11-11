'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import {
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABEL,
  type ReferralRow
} from '@/server/referrals/constants';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createReferralAction, updateReferralAction } from './actions';

export function NewReferral({ contacts }: { contacts: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState({
    referrerContactId: contacts[0]?.id ?? '',
    refereeName: '',
    refereePhone: '',
    notes: ''
  });
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const r = await createReferralAction({
        referrerContactId: input.referrerContactId,
        refereeName: input.refereeName,
        refereePhone: input.refereePhone,
        status: 'new',
        notes: input.notes
      });
      if (!r.ok) {
        notify.error(r.error.message);
        return;
      }
      notify.success('Referral added');
      setOpen(false);
      setInput({ ...input, refereeName: '', refereePhone: '', notes: '' });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={!contacts.length} variant='outline'>
            Add a referral
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a referral</DialogTitle>
          <DialogDescription>
            The person referred becomes a contact with the source “Referral”.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <label htmlFor='referral-referrer' className='flex flex-col gap-1 text-sm'>
            <span>Referred by</span>
            <NativeSelect
              id='referral-referrer'
              value={input.referrerContactId}
              onChange={(e) => setInput({ ...input, referrerContactId: e.target.value })}
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label htmlFor='referral-name' className='flex flex-col gap-1 text-sm'>
            <span>Name</span>
            <Input
              id='referral-name'
              value={input.refereeName}
              maxLength={200}
              required
              onChange={(e) => setInput({ ...input, refereeName: e.target.value })}
            />
          </label>
          <label htmlFor='referral-phone' className='flex flex-col gap-1 text-sm'>
            <span>Phone</span>
            <Input
              id='referral-phone'
              type='tel'
              value={input.refereePhone}
              required
              onChange={(e) => setInput({ ...input, refereePhone: e.target.value })}
            />
          </label>
          <label htmlFor='referral-notes' className='flex flex-col gap-1 text-sm'>
            <span>Notes (optional)</span>
            <Textarea
              id='referral-notes'
              value={input.notes}
              maxLength={2000}
              onChange={(e) => setInput({ ...input, notes: e.target.value })}
            />
          </label>
          {!contacts.length && (
            <p className='text-muted-foreground text-sm'>
              Add a contact before recording a referral.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              pending ||
              !input.referrerContactId ||
              !input.refereeName.trim() ||
              !input.refereePhone.trim()
            }
          >
            Add referral
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditReferral({
  row,
  canEditRewards
}: {
  row: ReferralRow;
  canEditRewards: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.notes);
  const [rewardDollars, setRewardDollars] = useState(
    row.rewardCents ? (row.rewardCents / 100).toFixed(2) : ''
  );
  const [rewardStatus, setRewardStatus] = useState(row.rewardStatus);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const rewardCents = rewardDollars.trim()
        ? Math.round(Number(rewardDollars) * 100)
        : undefined;
      const r = await updateReferralAction(row.id, {
        status,
        notes,
        ...(canEditRewards && rewardCents !== undefined ? { rewardCents } : {}),
        ...(canEditRewards ? { rewardStatus } : {})
      });
      if (!r.ok) {
        notify.error(r.error.message);
        return;
      }
      notify.success('Referral updated');
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='outline' size='sm'>Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit referral</DialogTitle>
          <DialogDescription>{row.refereeName}</DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <label htmlFor={`referral-status-${row.id}`} className='flex flex-col gap-1 text-sm'>
            <span>Status</span>
            <NativeSelect
              id={`referral-status-${row.id}`}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as (typeof REFERRAL_STATUSES)[number])
              }
            >
              {REFERRAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REFERRAL_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </label>
          {canEditRewards && (
            <div className='flex flex-wrap gap-3'>
              <label
                htmlFor={`referral-reward-${row.id}`}
                className='flex flex-col gap-1 text-sm'
              >
                <span>Reward ($)</span>
                <Input
                  id={`referral-reward-${row.id}`}
                  type='number'
                  min={0}
                  step='0.01'
                  value={rewardDollars}
                  onChange={(e) => setRewardDollars(e.target.value)}
                />
              </label>
              <label
                htmlFor={`referral-reward-status-${row.id}`}
                className='flex flex-col gap-1 text-sm'
              >
                <span>Reward status</span>
                <NativeSelect
                  id={`referral-reward-status-${row.id}`}
                  value={rewardStatus}
                  onChange={(e) =>
                    setRewardStatus(e.target.value as ReferralRow['rewardStatus'])
                  }
                >
                  <option value='none'>None</option>
                  <option value='pending'>Pending</option>
                  <option value='paid'>Paid</option>
                </NativeSelect>
              </label>
            </div>
          )}
          <label htmlFor={`referral-notes-${row.id}`} className='flex flex-col gap-1 text-sm'>
            <span>Notes</span>
            <Textarea
              id={`referral-notes-${row.id}`}
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
