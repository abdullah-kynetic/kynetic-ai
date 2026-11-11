import { z } from 'zod';
export const reportPeriodSchema = z.iso
  .date()
  .refine((value) => value.endsWith('-01'), 'period_start');
