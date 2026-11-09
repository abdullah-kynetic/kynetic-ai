'use server';
import { revalidatePath } from 'next/cache';
import { agencyCaller } from '../caller';
import { saveAgencyOps, rotateAgencySecret } from '@/server/agency/ops';
export async function saveOpsAction(form: FormData) {
  await saveAgencyOps(await agencyCaller(), {
    devWebhookUrl: String(form.get('devWebhookUrl') ?? ''),
    workflowName: String(form.get('workflowName') ?? ''),
    workflowId: String(form.get('workflowId') ?? '')
  });
  revalidatePath('/admin/agency/ops');
}
export async function rotateAgencySecretAction() {
  await rotateAgencySecret(await agencyCaller());
  revalidatePath('/admin/agency/ops');
}
