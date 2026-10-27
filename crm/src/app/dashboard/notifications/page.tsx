import PageContainer from '@/components/layout/page-container';
import { NotificationsPage } from '@/components/notifications/notifications-page';

export const metadata = { title: 'Notifications' };

export default function Page() {
  return (
    <PageContainer
      pageTitle='Notifications'
      pageDescription='Your latest leads, bookings and reminders.'
    >
      <NotificationsPage />
    </PageContainer>
  );
}
