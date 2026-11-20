'use server';

import { decideAdminAccess, listTenantOptions } from '@/server/admin';
import { applyIndustryTemplate, applySystemTemplate } from '@/server/admin/templates';
import {
  archiveAccountTemplate,
  listAccountTemplates,
  saveAccountTemplate
} from '@/server/admin/account-templates';
import {
  INDUSTRY_TEMPLATE_KEYS,
  type IndustryTemplateKey
} from '@/server/admin/industry-templates';
import { AppError } from '@/server/errors';
import { MODULE_KEYS, type ModuleKey } from '@/server/modules/keys';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { isViewingAs } from '../view-as-guard';

export type ApplyState =
  | { status: 'idle' }
  | { status: 'applied'; changed: boolean; detail?: string }
  | { status: 'error'; message: string };

export async function applyTemplate(_state: ApplyState, form: FormData): Promise<ApplyState> {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin')
    return {
      status: 'error',
      message: 'Only a Kynetic admin can apply a template.'
    };
  if (await isViewingAs(access.user))
    return {
      status: 'error',
      message: 'Exit view-as before applying a template.'
    };
  const actor = { id: access.user.id, kyneticRole: access.role };
  const kind = String(form.get('kind') ?? '');
  const templateKey = String(form.get('templateKey') ?? '');
  const tenantId = String(form.get('tenantId') ?? '');
  const crmLevel = String(form.get('crmLevel') ?? '');
  try {
    if (kind === 'industry') {
      if (!(INDUSTRY_TEMPLATE_KEYS as readonly string[]).includes(templateKey))
        return { status: 'error', message: 'That template is not available.' };
      const result = await applyIndustryTemplate(actor, {
        tenantId,
        industry: templateKey as IndustryTemplateKey
      });
      revalidatePath(`/admin/clients/${tenantId}`);
      revalidatePath('/dashboard', 'layout');
      const detail =
        result.stages === 'customized'
          ? 'The pipeline was already customized, so its stages were left as they are.'
          : undefined;
      return { status: 'applied', changed: result.changed, detail };
    }
    if (kind === 'system') {
      if (!(MODULE_KEYS as readonly string[]).includes(templateKey) || templateKey === 'platform')
        return { status: 'error', message: 'That system is not available.' };
      const result = await applySystemTemplate(actor, {
        tenantId,
        moduleKey: templateKey as ModuleKey,
        crmLevel: templateKey === 'crm' ? (crmLevel === 'full' ? 'full' : 'lite') : undefined
      });
      revalidatePath(`/admin/clients/${tenantId}`);
      revalidatePath(`/admin/clients/${tenantId}/systems`);
      revalidatePath('/dashboard', 'layout');
      return { status: 'applied', changed: result.changed };
    }
    return { status: 'error', message: 'That template is not available.' };
  } catch (error) {
    if (error instanceof AppError) return { status: 'error', message: error.message };
    throw error;
  }
}

export async function loadTemplateTenants() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') return [];
  return listTenantOptions({ id: access.user.id, kyneticRole: access.role });
}

export type AccountTemplateState =
  | { status: 'idle' }
  | { status: 'saved'; name: string }
  | { status: 'archived' }
  | { status: 'error'; message: string };

async function adminActor() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') return null;
  if (await isViewingAs(access.user)) return null;
  return { id: access.user.id, kyneticRole: access.role };
}

/** Saves a client's current setup as a named account template (GHL-style snapshot). */
export async function saveTemplateFromClient(
  _state: AccountTemplateState,
  form: FormData
): Promise<AccountTemplateState> {
  const actor = await adminActor();
  if (!actor)
    return {
      status: 'error',
      message: 'Only a Kynetic admin, not viewing as a client, can save a template.'
    };
  const name = String(form.get('name') ?? '').trim();
  try {
    await saveAccountTemplate(actor, {
      sourceTenantId: String(form.get('tenantId') ?? ''),
      name,
      description: String(form.get('description') ?? '')
    });
    revalidatePath('/admin/templates');
    revalidatePath('/admin/clients/new');
    return { status: 'saved', name };
  } catch (error) {
    if (error instanceof AppError) return { status: 'error', message: error.message };
    throw error;
  }
}

/** Archives an account template. Clients already made from it keep their setup. */
export async function archiveTemplate(
  _state: AccountTemplateState,
  form: FormData
): Promise<AccountTemplateState> {
  const actor = await adminActor();
  if (!actor)
    return {
      status: 'error',
      message: 'Only a Kynetic admin, not viewing as a client, can archive a template.'
    };
  try {
    await archiveAccountTemplate(actor, String(form.get('templateId') ?? ''));
    revalidatePath('/admin/templates');
    revalidatePath('/admin/clients/new');
    return { status: 'archived' };
  } catch (error) {
    if (error instanceof AppError) return { status: 'error', message: error.message };
    throw error;
  }
}

export async function loadAccountTemplates() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') return [];
  return listAccountTemplates({ id: access.user.id, kyneticRole: access.role });
}
