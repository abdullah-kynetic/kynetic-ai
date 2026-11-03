import { redirect } from 'next/navigation';

// There is no settings landing page; the sidebar lists each settings page. Send visitors to the first.
export default function SettingsIndexPage() {
  redirect('/dashboard/settings/business');
}
