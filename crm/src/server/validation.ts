import { z } from 'zod';
import { ValidationError, type FieldErrors } from './errors';

// Field limits are defined once, here (SECURITY 5.1).
export const FIELD_LIMITS = {
  name: 200,
  note: 20_000,
  messageBody: 1_600,
  customText: 2_000,
  tagsPerContact: 100,
  customFieldsPerEntity: 50,
  listLimitMax: 200,
  listLimitDefault: 50,
  jsonBodyBytes: 1_000_000
} as const;

/** Reasons only. Zod messages can quote allowed values, so the issue code is what leaves the server. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  const add = (path: PropertyKey[], reason: string) => {
    const key = path.map(String).join('.');
    (out[key] ??= []).push(reason);
  };
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const k of issue.keys) add([...issue.path, k], 'unrecognized_key');
    } else {
      add(issue.path, issue.code);
    }
  }
  return out;
}

/** Parse at a trust boundary. Throws ValidationError (400, VALIDATION_FAILED) with field paths. */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError(toFieldErrors(result.error));
  return result.data;
}

/** Read and parse a JSON request body. Unknown keys are rejected when the schema is strict. */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes: number = FIELD_LIMITS.jsonBodyBytes
): Promise<z.output<S>> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new ValidationError({ '': ['too_big'] });
  const text = await request.text();
  if (text.length > maxBytes) throw new ValidationError({ '': ['too_big'] });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ValidationError({ '': ['invalid_json'] });
  }
  return parseInput(schema, json);
}

/** Parse query-string params. Repeated keys become arrays. */
export function parseSearchParams<S extends z.ZodType>(
  source: URL | URLSearchParams,
  schema: S
): z.output<S> {
  const params = source instanceof URL ? source.searchParams : source;
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    obj[key] = all.length > 1 ? all : all[0];
  }
  return parseInput(schema, obj);
}

// Shared building blocks (SECURITY 5.1): UUID ids, lowercased emails, E.164 phones, capped limits.
export const uuidSchema = z.uuid();
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const e164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/, 'E.164 phone number');
export const nameSchema = z.string().trim().min(1).max(FIELD_LIMITS.name);
export const listLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(FIELD_LIMITS.listLimitMax)
  .default(FIELD_LIMITS.listLimitDefault);
