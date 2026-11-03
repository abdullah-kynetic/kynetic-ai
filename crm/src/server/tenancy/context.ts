import { z } from 'zod';

export const appRoleSchema = z.enum(['owner', 'staff', 'admin', 'va', 'system']);
export type AppRole = z.infer<typeof appRoleSchema>;

/** Roles held by Kynetic staff. They reach tenant data only through view-as or roll-up functions. */
export const KYNETIC_ROLES = ['admin', 'va'] as const satisfies readonly AppRole[];

export const tenantContextSchema = z.object({
  tenantId: z.uuid(),
  userId: z.uuid().optional(),
  role: appRoleSchema,
  /** Set only by a view-as session; stamped on audit rows. */
  impersonatorId: z.uuid().optional(),
  readOnly: z.boolean().default(false)
});

export type TenantContextInput = z.input<typeof tenantContextSchema>;
export type TenantContext = z.output<typeof tenantContextSchema>;

export const platformContextSchema = z.object({
  userId: z.uuid(),
  role: z.enum(KYNETIC_ROLES)
});
export type PlatformContext = z.infer<typeof platformContextSchema>;
