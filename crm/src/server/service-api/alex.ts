import type { Tx } from '../db/client';
import {
  AlexConfigMissingError,
  clientAlexUpdateSchema,
  getAlexSettingsView,
  updateClientAlexSettings
} from '../alex';
import { AppError, ValidationError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { ownerUserId } from './owner';

// Alex pause and call hours for the service API (C13, part 2b). Reads show the owner view, which
// never includes the raw prompt. Writes are the portal's client update: pause and call hours only,
// audited by the portal function. Changing Alex needs alex:write.

export async function getServiceAlex(tx: Tx, svc: ServiceContext) {
  const view = await getAlexSettingsView(tx);
  if (!view) throw new AppError('NOT_FOUND');
  return view;
}

export async function patchServiceAlex(tx: Tx, svc: ServiceContext, input: unknown) {
  const parsed = clientAlexUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({ body: [parsed.error.issues[0]?.message ?? 'invalid'] });
  }
  const userId = await ownerUserId(tx, svc);
  try {
    await updateClientAlexSettings(tx, parsed.data, userId);
  } catch (error) {
    if (error instanceof AlexConfigMissingError) throw new AppError('NOT_FOUND');
    throw error;
  }
  const view = await getAlexSettingsView(tx);
  if (!view) throw new AppError('NOT_FOUND');
  return view;
}
