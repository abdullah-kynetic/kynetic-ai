import { z } from 'zod';
import { AppError } from '../errors';

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' '
  )
);
export const businessStateSchema = z
  .string()
  .trim()
  .transform((value) => {
    const state = value.toUpperCase();
    return state === 'FLORIDA' ? 'FL' : state === 'OKLAHOMA' ? 'OK' : state;
  })
  .refine(
    (value) => US_STATES.has(value) && value !== 'FL' && value !== 'OK',
    'unsupported_business_state'
  );

export function assertDevPortal(baseUrl: string): void {
  const url = new URL(baseUrl);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'dev.kyneticai.com' ||
    url.username ||
    url.password
  ) {
    throw new AppError('FORBIDDEN', { message: 'This operation is dev-only.' });
  }
}
