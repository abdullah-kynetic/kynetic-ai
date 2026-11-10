import PageContainer from '@/components/layout/page-container';
import { AutomationHistoryDrawer } from '@/components/automations/history-drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { automationHistory, listAutomationTemplates } from '@/server/automations';
import { stageScope } from '@/server/deals';
import { headers } from 'next/headers';
import { toggleAutomation } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automations' };

export default async function AutomationSettingsPage() {
  const { ctx } = await stageScope(await headers());
  const templates = await listAutomationTemplates(ctx);
  const histories = await Promise.all(
    templates.map(async (template) => ({
      key: template.key,
      history: await automationHistory(ctx, template.key)
    }))
  );
  const byKey = new Map(histories.map((row) => [row.key, row.history]));
  return (
    <PageContainer
      pageTitle='Automations'
      pageDescription='Turn approved follow-up templates on or off, and see how recent runs finished.'
    >
      <div className='grid gap-4 md:grid-cols-2'>
        {templates.map(({ key, label, moduleKey, automation }) => {
          const history = byKey.get(key);
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4'>
                <p className='text-muted-foreground text-sm'>Module: {moduleKey ?? 'platform'}</p>
                {history ? (
                  <AutomationHistoryDrawer
                    label={label}
                    summary={history.summary}
                    runs={history.runs}
                  />
                ) : null}
                <form action={toggleAutomation.bind(null, key, !automation?.enabled)}>
                  <Button type='submit' variant={automation?.enabled ? 'outline' : 'default'}>
                    {automation?.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
