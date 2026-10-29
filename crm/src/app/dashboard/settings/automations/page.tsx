import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listAutomationTemplates } from '@/server/automations';
import { stageScope } from '@/server/deals';
import { headers } from 'next/headers';
import { toggleAutomation } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automations' };

export default async function AutomationSettingsPage() {
  const { ctx } = await stageScope(await headers());
  const templates = await listAutomationTemplates(ctx);
  return (
    <PageContainer
      pageTitle='Automations'
      pageDescription='Turn approved follow-up templates on or off.'
    >
      <div className='grid gap-4 md:grid-cols-2'>
        {templates.map(({ key, label, moduleKey, automation }) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-muted-foreground text-sm'>Module: {moduleKey ?? 'platform'}</p>
              <form
                action={toggleAutomation.bind(null, key, !automation?.enabled)}
                className='mt-4'
              >
                <button className='rounded border px-3 py-2 text-sm' type='submit'>
                  {automation?.enabled ? 'Disable' : 'Enable'}
                </button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
