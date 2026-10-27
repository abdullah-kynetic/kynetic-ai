import PageContainer from '@/components/layout/page-container';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { StatusBadge, type StatusTone } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { listTenantOptions, listUsers, type UserRow } from '@/server/admin';
import { requireUser } from '@/server/auth';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { z } from 'zod';
import { InviteForm } from './invite-form';
import { UserActions } from './user-actions';

export const metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

const TONE: Record<UserRow['status'], StatusTone> = {
  active: 'success',
  disabled: 'error',
  invited: 'info'
};
const LABEL: Record<UserRow['status'], string> = {
  active: 'Active',
  disabled: 'Deactivated',
  invited: 'Invited'
};

/** Users across tenants (F-61, M8a-03). Admin: everything. VA: list, invite and reset client users. */
export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; tenant?: string }>;
}) {
  const user = await requireUser(await headers());
  if (!user.kyneticRole) forbidden();
  const who = { id: user.id, kyneticRole: user.kyneticRole };
  const { q, tenant } = await searchParams;
  const tenantId = z.uuid().safeParse(tenant).data;
  const [rows, tenants] = await Promise.all([
    listUsers(who, { search: q?.slice(0, 200), tenantId }),
    listTenantOptions(who)
  ]);

  return (
    <PageContainer
      pageTitle='Users'
      pageDescription='Everyone with access, across all clients. Invite, reset or deactivate from here.'
    >
      <div className='space-y-6'>
        <section aria-labelledby='invite-heading' className='space-y-3'>
          <h2 id='invite-heading' className='text-base font-medium'>
            Invite a client user
          </h2>
          <InviteForm tenants={tenants} />
        </section>

        <form method='get' className='flex flex-wrap items-end gap-3' role='search'>
          <Input
            name='q'
            defaultValue={q}
            placeholder='Search name or email'
            aria-label='Search users'
            className='w-64'
          />
          <NativeSelect name='tenant' defaultValue={tenantId ?? ''} aria-label='Filter by client'>
            <NativeSelectOption value=''>All clients</NativeSelectOption>
            {tenants.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type='submit' variant='outline'>
            Filter
          </Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground'>
                  No users match.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={`${r.userId ?? r.invitationId}:${r.tenantId ?? 'none'}`}>
                <TableCell>
                  <div className='font-medium'>{r.email}</div>
                  {r.name && <div className='text-muted-foreground text-xs'>{r.name}</div>}
                </TableCell>
                <TableCell>{r.tenantName ?? 'Kynetic'}</TableCell>
                <TableCell>
                  {r.kyneticRole
                    ? r.kyneticRole === 'admin'
                      ? 'Kynetic admin'
                      : 'Kynetic VA'
                    : r.membershipRole === 'owner'
                      ? 'Owner'
                      : 'Staff'}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={TONE[r.status]}>{LABEL[r.status]}</StatusBadge>
                </TableCell>
                <TableCell>
                  {r.status === 'invited'
                    ? `Expires ${r.inviteExpiresAt?.toLocaleDateString('en-US') ?? ''}`
                    : (r.lastLoginAt?.toLocaleDateString('en-US') ?? 'Never')}
                </TableCell>
                <TableCell>
                  {r.userId && r.status !== 'invited' ? (
                    <UserActions
                      viewerRole={user.kyneticRole!}
                      row={{
                        userId: r.userId,
                        email: r.email,
                        status: r.status,
                        kyneticRole: r.kyneticRole,
                        tenantId: r.tenantId,
                        membershipRole: r.membershipRole,
                        isSelf: r.userId === user.id
                      }}
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageContainer>
  );
}
