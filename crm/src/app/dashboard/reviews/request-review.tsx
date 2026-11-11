'use client';

import { Button } from '@/components/ui/button';
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
import { notify } from '@/lib/notify';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { requestReviewAction } from './actions';

export function RequestReview({
  contacts
}: {
  contacts: { id: string; name: string; phone: string | null; email: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const r = await requestReviewAction({ contactId, channel });
      if (!r.ok) {
        notify.error(r.error.message);
        return;
      }
      notify.success('Review request queued');
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={!contacts.length} variant='outline'>
            Request a review
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a review</DialogTitle>
          <DialogDescription>
            We queue the request now and send it once live messaging is on. Nothing is sent today.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <label htmlFor='review-contact' className='flex flex-col gap-1 text-sm'>
            <span>Contact</span>
            <NativeSelect
              id='review-contact'
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ''}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label htmlFor='review-channel' className='flex flex-col gap-1 text-sm'>
            <span>Channel</span>
            <NativeSelect
              id='review-channel'
              value={channel}
              onChange={(e) => setChannel(e.target.value === 'email' ? 'email' : 'sms')}
            >
              <option value='sms'>Text message</option>
              <option value='email'>Email</option>
            </NativeSelect>
          </label>
          {!contacts.length && (
            <p className='text-muted-foreground text-sm'>
              Add a contact before requesting a review.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !contactId}>
            Queue request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
