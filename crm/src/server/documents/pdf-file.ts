import { ValidationError } from '../errors';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** PDF uploads share one rule: the name ends in .pdf, the body starts with %PDF-, and the size is capped. */
export function assertPdfUpload(fileName: string, body: Uint8Array) {
  if (body.byteLength < 8 || body.byteLength > MAX_DOCUMENT_BYTES)
    throw new ValidationError({ file: ['invalid_size'] });
  if (
    !fileName.toLowerCase().endsWith('.pdf') ||
    new TextDecoder().decode(body.slice(0, 5)) !== '%PDF-'
  )
    throw new ValidationError({ file: ['pdf_required'] });
}
