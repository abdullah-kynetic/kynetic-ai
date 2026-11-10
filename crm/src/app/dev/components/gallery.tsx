'use client';

import * as React from 'react';
import { IconInbox } from '@tabler/icons-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoAccess } from '@/components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';

export function ComponentGallery() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-8 p-6'>
      <h1 className='font-display text-3xl font-semibold'>Base components</h1>

      <section aria-labelledby='g-buttons' className='flex flex-col gap-3'>
        <h2 id='g-buttons' className='text-lg font-semibold'>
          Buttons
        </h2>
        <div className='flex flex-wrap gap-2'>
          <Button>Primary</Button>
          <Button variant='secondary'>Secondary</Button>
          <Button variant='ghost'>Ghost</Button>
          <Button variant='destructive'>Destructive</Button>
          <Button variant='destructive-solid'>Delete 12 contacts</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section aria-labelledby='g-fields' className='flex flex-col gap-3'>
        <h2 id='g-fields' className='text-lg font-semibold'>
          Fields
        </h2>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='g-name'>Name (required)</Label>
          <Input id='g-name' placeholder='Dana Reyes' />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='g-phone'>Phone</Label>
          <Input id='g-phone' aria-invalid aria-describedby='g-phone-err' defaultValue='555' />
          <p id='g-phone-err' className='text-sm text-destructive'>
            Enter a 10-digit US phone number
          </p>
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='g-off'>Locked</Label>
          <Input id='g-off' disabled defaultValue='Read only for your role' />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='g-note'>Note</Label>
          <Textarea id='g-note' />
        </div>
      </section>

      <section aria-labelledby='g-chips' className='flex flex-col gap-3'>
        <h2 id='g-chips' className='text-lg font-semibold'>
          Badges
        </h2>
        <div className='flex flex-wrap gap-2'>
          <StatusBadge tone='success'>Booked</StatusBadge>
          <StatusBadge tone='info'>Qualified</StatusBadge>
          <StatusBadge tone='neutral'>No answer</StatusBadge>
          <StatusBadge tone='warning'>Consent expiring</StatusBadge>
          <StatusBadge tone='error'>Overdue</StatusBadge>
          <Badge variant='outline'>roof-repair</Badge>
        </div>
      </section>

      <section aria-labelledby='g-table' className='flex flex-col gap-3'>
        <h2 id='g-table' className='text-lg font-semibold'>
          Table
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope='col'>Lead</TableHead>
              <TableHead scope='col' data-numeric>
                Value
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Dana Reyes</TableCell>
              <TableCell data-numeric>$1,250</TableCell>
            </TableRow>
            <TableRow data-state='selected'>
              <TableCell>Lee Park</TableCell>
              <TableCell data-numeric>$8,900</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section aria-labelledby='g-overlays' className='flex flex-col gap-3'>
        <h2 id='g-overlays' className='text-lg font-semibold'>
          Dialog and toast
        </h2>
        <div className='flex flex-wrap gap-2'>
          <Dialog>
            <DialogTrigger render={<Button variant='secondary'>Open dialog</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add contact</DialogTitle>
                <DialogDescription>Enter the details for the new contact.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant='secondary'>Cancel</Button>
                <Button>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant='secondary' onClick={() => notify.success('Contact saved')}>
            Success toast
          </Button>
          <Button variant='secondary' onClick={() => notify.error('Could not save the contact')}>
            Error toast
          </Button>
        </div>
      </section>

      <section aria-labelledby='g-states' className='flex flex-col gap-3'>
        <h2 id='g-states' className='text-lg font-semibold'>
          Empty, loading, error
        </h2>
        <EmptyState
          icon={<IconInbox aria-hidden='true' />}
          title='No leads yet'
          description='New leads from your ads appear here as Alex calls them.'
          action={
            <Button type='button' disabled>
              Demo only
            </Button>
          }
        />
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-6 w-1/2' />
          <Skeleton className='h-6 w-2/3' />
        </div>
        <ErrorState
          message='We could not load your leads.'
          reference='req_8f3a21'
          onRetry={() => undefined}
        />
        <NoAccess />
      </section>
    </main>
  );
}
