import { currentTime } from '@/components/timeline/format';
import PageContainer from '@/components/layout/page-container';
import { presentTasks } from '@/components/tasks/present';
import { TaskList, type TaskGroup } from '@/components/tasks/task-list';
import { NoAccess } from '@/components/ui/states';
import { moduleSatisfied } from '@/server/modules/keys';
import { loadShellContext } from '@/server/shell';
import { getTenantTimezone, listAssignees, listMyTasks } from '@/server/tasks';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'My Tasks',
  robots: { index: false, follow: false }
};

// My Tasks (M3-02; PRD F-20): open tasks grouped Overdue, Today, Upcoming. CRM Lite.
export default async function TasksPage({
  searchParams
}: {
  searchParams: Promise<{ scope?: string | string[] }>;
}) {
  const [sp, cookieStore, requestHeaders] = await Promise.all([searchParams, cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) notFound();
  // The service refuses without the module too; this keeps the page from erroring for a tenant without it.
  const enabled = { keys: new Set(shell.modules.keys), crmLevel: shell.modules.crmLevel };
  if (!moduleSatisfied(enabled, { module: 'crm', level: 'lite' })) {
    return (
      <PageContainer pageTitle='My Tasks'>
        <NoAccess
          title='Tasks are not part of your plan'
          description='Ask your Kynetic contact about adding the CRM.'
        />
      </PageContainer>
    );
  }

  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  const scope = sp.scope === 'all' ? 'all' : 'mine';
  const at = currentTime();
  const [timezone, assignees, mine] = await Promise.all([
    getTenantTimezone(ctx),
    listAssignees(ctx),
    listMyTasks(ctx, { scope }, { now: at })
  ]);

  const groups: TaskGroup[] = [
    { key: 'overdue', label: 'Overdue', tone: 'error', tasks: mine.overdue },
    { key: 'today', label: 'Today', tasks: mine.today },
    { key: 'upcoming', label: 'Upcoming', tasks: mine.upcoming }
  ];
  const open = [...mine.overdue, ...mine.today, ...mine.upcoming];
  const overdueText = presentTasks(mine.overdue, timezone, at, true);
  const rest = presentTasks([...mine.today, ...mine.upcoming], timezone, at);

  return (
    <PageContainer
      pageTitle='My Tasks'
      pageDescription={scope === 'all' ? 'Every open task on the team.' : 'Your open follow-ups.'}
      pageHeaderAction={
        <Link
          className='text-primary-text text-sm underline-offset-4 hover:underline'
          href={scope === 'all' ? '/dashboard/tasks' : '/dashboard/tasks?scope=all'}
        >
          {scope === 'all' ? 'Show only mine' : 'Show the whole team'}
        </Link>
      }
    >
      <TaskList
        groups={groups}
        assignees={assignees}
        timezone={timezone}
        currentUserId={shell.user.id}
        showContact
        dueLocal={{ ...overdueText.dueLocal, ...rest.dueLocal }}
        dueText={{ ...overdueText.dueText, ...rest.dueText }}
        emptyTitle={open.length === 0 ? "Nothing due. You're caught up." : undefined}
      />
    </PageContainer>
  );
}
