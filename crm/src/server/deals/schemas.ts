import { z } from 'zod';
import { FIELD_LIMITS, uuidSchema } from '../validation';
import { MAX_VALUE_CENTS } from './money';

const text = (max: number) => z.string().trim().min(1).max(max);

export const DEAL_ROLES = ['homeowner', 'spouse', 'tenant', 'property_manager', 'other'] as const;

export type DealRole = (typeof DEAL_ROLES)[number];

export const dealContactRoleSchema = z.strictObject({
  contactId: uuidSchema,
  role: z.enum(DEAL_ROLES)
});

const fields = {
  title: text(FIELD_LIMITS.name),
  valueCents: z.number().int().min(0).max(MAX_VALUE_CENTS),
  serviceType: text(100).nullable(),
  expectedClose: z.iso.date().nullable(),
  ownerId: uuidSchema.nullable(),
  source: text(100).nullable(),
  custom: z.record(z.string(), z.unknown())
};

export const createDealSchema = z.strictObject({
  title: fields.title,
  valueCents: fields.valueCents.default(0),
  serviceType: fields.serviceType.optional(),
  expectedClose: fields.expectedClose.optional(),
  ownerId: fields.ownerId.optional(),
  source: fields.source.optional(),
  custom: fields.custom.default({}),
  /** Defaults to the tenant's default pipeline. */
  pipelineId: uuidSchema.optional(),
  /** Defaults to the first stage of the pipeline. */
  stageId: uuidSchema.optional(),
  /** Required when the deal is created straight into a Lost stage. */
  lostReason: text(500).optional(),
  /** The person the job is for; linked with the role `homeowner`. */
  contactId: uuidSchema.optional()
});
export type CreateDealInput = z.input<typeof createDealSchema>;

export const updateDealSchema = z
  .strictObject({
    title: fields.title,
    valueCents: fields.valueCents,
    serviceType: fields.serviceType,
    expectedClose: fields.expectedClose,
    ownerId: fields.ownerId,
    source: fields.source,
    custom: fields.custom
  })
  .partial();
export type UpdateDealInput = z.input<typeof updateDealSchema>;

export const moveDealSchema = z.strictObject({
  stageId: uuidSchema,
  /** Place the card right after this deal; null puts it at the top. Omitted puts it at the bottom. */
  afterDealId: uuidSchema.nullable().optional(),
  /** Required when the target is a Lost stage (F-14). */
  lostReason: text(500).optional()
});
export type MoveDealInput = z.input<typeof moveDealSchema>;

export const listDealsSchema = z.strictObject({
  pipelineId: uuidSchema.optional(),
  stageId: uuidSchema.optional(),
  ownerId: uuidSchema.optional(),
  source: text(100).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(FIELD_LIMITS.listLimitMax)
    .default(FIELD_LIMITS.listLimitDefault),
  offset: z.number().int().min(0).default(0)
});
export type ListDealsInput = z.input<typeof listDealsSchema>;

export const boardFiltersSchema = z.strictObject({
  pipelineId: uuidSchema.optional(),
  ownerId: uuidSchema.optional(),
  source: text(100).optional()
});
export type BoardFilters = z.input<typeof boardFiltersSchema>;

const stageName = z.string().trim().min(1).max(60);

export const createStageSchema = z.strictObject({
  name: stageName,
  probability: z.number().int().min(0).max(100).default(20),
  pipelineId: uuidSchema.optional()
});
export type CreateStageInput = z.input<typeof createStageSchema>;

export const updateStageSchema = z
  .strictObject({ name: stageName, probability: z.number().int().min(0).max(100) })
  .partial();
export type UpdateStageInput = z.input<typeof updateStageSchema>;

export const reorderStagesSchema = z.strictObject({
  pipelineId: uuidSchema.optional(),
  stageIds: z.array(uuidSchema).min(1).max(50)
});
export type ReorderStagesInput = z.input<typeof reorderStagesSchema>;

export const deleteStageSchema = z.strictObject({
  /** Required when the stage still has deals; they move here, in their current order. */
  moveToStageId: uuidSchema.optional()
});
export type DeleteStageInput = z.input<typeof deleteStageSchema>;
