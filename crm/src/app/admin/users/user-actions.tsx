'use client';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Modal } from '@/components/ui/modal';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { notify } from '@/lib/notify';
import * as React from 'react';
import {
  changeMembershipRoleAction,
  changeStaffRoleAction,
  deactivateUserAction,
  reactivateUserAction,
  resetClientUserAction,
  resetStaffTwoFactorAction,
  type ActionResult
} from './actions';

export type RowForActions = {
  userId: string;
  email: string;
  status: 'active' | 'disabled';
  kyneticRole: 'admin' | 'va' | null;
  tenantId: string | null;
  membershipRole: 'owner' | 'staff' | null;
  isSelf: boolean;
};

/**
 * Per-row actions. The server decides what is allowed; this only avoids offering what the signed-in
 * role cannot do (a VA sees invite and reset on client users, nothing on staff or admins).
 */
export function UserActions({
  row,
  viewerRole
}: {
  row: RowForActions;
  viewerRole: 'admin' | 'va';
}) {
  const [pending, start] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  const [resetTotp, setResetTotp] = React.useState(false);
  const isAdmin = viewerRole === 'admin';
  const isStaff = row.kyneticRole !== null;

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) notify.success(res.message);
      else notify.error(res.message);
      after?.();
    });

  if (row.isSelf) return <span className='text-muted-foreground text-xs'>This is you</span>;

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {!isStaff && row.status === 'active' && (
        <Button
          size='sm'
          variant='outline'
          disabled={pending}
          onClick={() => run(() => resetClientUserAction(row.userId))}
        >
          Reset access
        </Button>
      )}
      {isAdmin && row.tenantId && row.membershipRole && (
        <NativeSelect
          size='sm'
          aria-label={`Role of ${row.email} in this client`}
          value={row.membershipRole}
          disabled={pending}
          onChange={(e) =>
            run(() =>
              changeMembershipRoleAction(
                row.tenantId!,
                row.userId,
                e.target.value as 'owner' | 'staff'
              )
            )
          }
        >
          <NativeSelectOption value='owner'>Owner</NativeSelectOption>
          <NativeSelectOption value='staff'>Staff</NativeSelectOption>
        </NativeSelect>
      )}
      {isAdmin && isStaff && (
        <Button size='sm' variant='outline' disabled={pending} onClick={() => setResetTotp(true)}>
          Reset authenticator
        </Button>
      )}
      {isAdmin && isStaff && (
        <NativeSelect
          size='sm'
          aria-label={`Kynetic role of ${row.email}`}
          value={row.kyneticRole ?? ''}
          disabled={pending}
          onChange={(e) =>
            run(() =>
              changeStaffRoleAction(row.userId, (e.target.value || null) as 'admin' | 'va' | null)
            )
          }
        >
          <NativeSelectOption value='admin'>Kynetic admin</NativeSelectOption>
          <NativeSelectOption value='va'>Kynetic VA</NativeSelectOption>
          <NativeSelectOption value=''>Remove Kynetic access</NativeSelectOption>
        </NativeSelect>
      )}
      {isAdmin && row.status === 'active' && (
        <Button size='sm' variant='destructive' disabled={pending} onClick={() => setConfirm(true)}>
          Deactivate
        </Button>
      )}
      {isAdmin && row.status === 'disabled' && (
        <Button
          size='sm'
          variant='outline'
          disabled={pending}
          onClick={() => run(() => reactivateUserAction(row.userId))}
        >
          Reactivate
        </Button>
      )}
      <Modal
        title={`Reset authenticator for ${row.email}?`}
        description='This removes their authenticator and signs them out everywhere. They enroll again at the next sign-in. The reset is written to the audit log.'
        isOpen={resetTotp}
        onClose={() => setResetTotp(false)}
      >
        <div className='flex w-full items-center justify-end space-x-2 pt-6'>
          <Button variant='outline' onClick={() => setResetTotp(false)}>
            Cancel
          </Button>
          <LoadingButton
            loading={pending}
            onClick={() =>
              run(
                () => resetStaffTwoFactorAction(row.userId),
                () => setResetTotp(false)
              )
            }
          >
            Reset authenticator
          </LoadingButton>
        </div>
      </Modal>
      <Modal
        title={`Deactivate ${row.email}?`}
        description='They are signed out everywhere right away and cannot sign in until you reactivate them. Pending invites are revoked.'
        isOpen={confirm}
        onClose={() => setConfirm(false)}
      >
        <div className='flex w-full items-center justify-end space-x-2 pt-6'>
          <Button variant='outline' onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <LoadingButton
            loading={pending}
            variant='destructive'
            onClick={() =>
              run(
                () => deactivateUserAction(row.userId),
                () => setConfirm(false)
              )
            }
          >
            Deactivate
          </LoadingButton>
        </div>
      </Modal>
    </div>
  );
}
