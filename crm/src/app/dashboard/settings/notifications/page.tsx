import { SettingsPage } from '../settings-page';
import { stageScope } from '@/server/deals';
import { listMyPreferences } from '@/server/notifications';
import { headers } from 'next/headers';
import { PreferencesForm } from './preferences-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notification preferences' };

export default async function NotificationSettingsPage() {
  const { ctx } = await stageScope(await headers());
  return (
    <SettingsPage
      pageTitle='Notification preferences'
      pageDescription='Choose which notifications also reach you by email. The bell always shows all of them.'
    >
      <PreferencesForm initial={await listMyPreferences(ctx)} />
    </SettingsPage>
  );
}
