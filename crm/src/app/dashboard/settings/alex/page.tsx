import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { can, getSessionUser, resolveActor } from '@/server/auth';
import { getAlexSettingsView } from '@/server/alex';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlexControls } from './alex-controls';
import { requestAlexChangeAction } from './actions';
import { requireModule } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import { withTenant } from '@/server/tenancy';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Alex settings',
  robots: { index: false, follow: false }
};
export const dynamic = 'force-dynamic';

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function Rows({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className='text-muted-foreground text-sm'>Not set.</p>;
  return (
    <dl className='grid gap-2 text-sm sm:grid-cols-[12rem_1fr]'>
      {entries.map(([k, v]) => (
        <div key={k} className='contents'>
          <dt className='text-muted-foreground'>{k.replaceAll('_', ' ')}</dt>
          <dd>{formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AlexSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [cookieStore, requestHeaders, query] = await Promise.all([
    cookies(),
    headers(),
    searchParams
  ]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) notFound();

  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  await requireModule(ctx, 'alex_core');

  const user = await getSessionUser(requestHeaders);
  if (!user) redirect('/sign-in');
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, 'alex.settings.client', shell.tenant.id)) notFound();

  const settings = await withTenant(ctx, (tx) => getAlexSettingsView(tx));

  return (
    <PageContainer
      pageTitle='Alex settings'
      pageDescription='How Alex answers and when Alex calls. You can pause Alex and set call hours here. To change anything else, ask Kynetic.'
    >
      {!settings ? (
        <p className='text-muted-foreground text-sm'>Alex is not set up for this account yet.</p>
      ) : (
        <div className='grid gap-4'>
          <Card>
            <CardHeader>
              <CardTitle>Status and call hours</CardTitle>
              <CardDescription>
                Currently{' '}
                <Badge variant={settings.paused ? 'secondary' : 'default'}>
                  {settings.paused ? 'Paused' : 'Active'}
                </Badge>
                . Quiet-hours and state rules also apply.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlexControls
                paused={settings.paused}
                start={String(settings.callWindows.start ?? '09:00')}
                end={String(settings.callWindows.end ?? '17:00')}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Greeting</CardTitle>
            </CardHeader>
            <CardContent className='text-sm'>{settings.greeting ?? 'Not set.'}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Qualification questions</CardTitle>
            </CardHeader>
            <CardContent>
              {settings.questions.length === 0 ? (
                <p className='text-muted-foreground text-sm'>Not set.</p>
              ) : (
                <ol className='list-decimal space-y-1 ps-5 text-sm'>
                  {settings.questions.map((q, i) => (
                    <li key={i}>
                      {formatValue(
                        typeof q === 'object' && q ? ((q as { text?: unknown }).text ?? q) : q
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Booking rules</CardTitle>
            </CardHeader>
            <CardContent>
              <Rows data={settings.bookingRules} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Transfer number</CardTitle>
            </CardHeader>
            <CardContent className='text-sm'>{settings.transferNumber ?? 'Not set.'}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Request a change to Alex</CardTitle>
              <CardDescription>
                Tell us what Alex should do differently. The script itself stays with Kynetic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <details>
                <summary className='min-h-11 cursor-pointer font-medium'>
                  Request a change to Alex
                </summary>
                <form action={requestAlexChangeAction} className='mt-3 grid gap-3'>
                  {query.error ? (
                    <p role='alert' className='text-destructive text-sm'>
                      {query.error === 'permission'
                        ? 'You do not have permission to change Alex settings.'
                        : query.error === 'read-only'
                          ? 'This view is read-only.'
                          : 'Describe the change, then try again.'}
                    </p>
                  ) : null}
                  <label htmlFor='alex-change' className='text-sm font-medium'>
                    What should Alex do differently?
                  </label>
                  <Textarea id='alex-change' name='body' required maxLength={5000} rows={4} />
                  <div>
                    <Button type='submit'>Send request</Button>
                  </div>
                </form>
              </details>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
