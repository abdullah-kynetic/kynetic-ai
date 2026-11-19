import { SettingsPage } from '../settings-page';
import { CustomFieldsManager } from '@/features/custom-fields/custom-fields-manager';
import { customFieldsScope, listFieldDefs } from '@/server/custom-fields';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Custom fields' };

// Custom fields settings (M1-06, PRD F-12 and F-43). Open to every client (P1-4); who may edit the
// definitions is the service's rule.
export default async function CustomFieldsPage() {
  const scope = await customFieldsScope(await headers());
  if (!scope) {
    return (
      <SettingsPage pageTitle='Custom fields' access={false}>
        {null}
      </SettingsPage>
    );
  }
  const defs = await listFieldDefs(scope.ctx);
  return (
    <SettingsPage
      pageTitle='Custom fields'
      pageDescription='Add fields that are specific to your business. They show up on every contact, in the list and in filters.'
    >
      <CustomFieldsManager defs={defs} canEdit={scope.canEdit} />
    </SettingsPage>
  );
}
