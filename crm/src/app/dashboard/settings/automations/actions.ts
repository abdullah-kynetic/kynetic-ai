'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { stageScope } from '@/server/deals';
import { setAutomationEnabled } from '@/server/automations';

export async function toggleAutomation(key: string, enabled: boolean) {
  const { ctx, actor } = await stageScope(await headers());
  await setAutomationEnabled(ctx, actor, key as never, enabled, {
    keys: new Set(['platform', 'alex_core', 'crm']),
    crmLevel: 'full'
  });
  revalidatePath('/dashboard/settings/automations');
}
