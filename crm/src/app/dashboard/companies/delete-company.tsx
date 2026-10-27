'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { deleteCompanyAction } from './actions';

export function DeleteCompany({ id, name }: { id: string; name: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant='destructive' />}>
        Delete company
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The company leaves your lists. Its contacts and deals are kept, and the contacts are no
            longer linked to a company.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={deleteCompanyAction.bind(null, id)}>
            <Button type='submit' variant='destructive-solid'>
              Delete
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
