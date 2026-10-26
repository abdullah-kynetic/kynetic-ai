import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '@/server/errors';
import {
  e164Schema,
  emailSchema,
  listLimitSchema,
  parseInput,
  parseJsonBody,
  parseSearchParams
} from '@/server/validation';

const schema = z.strictObject({ name: z.string().min(1), age: z.number().int() });

const json = (body: string) =>
  new Request('http://localhost/x', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' }
  });

describe('Zod helpers (SECURITY 5.1)', () => {
  it('returns parsed data', () => {
    expect(parseInput(schema, { name: 'a', age: 3 })).toEqual({ name: 'a', age: 3 });
  });

  it('rejects with field paths and issue codes, never the submitted value', () => {
    try {
      parseInput(schema, { name: '', age: 'secret-value', extra: 1 });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const fields = (err as ValidationError).fieldErrors!;
      expect(Object.keys(fields).toSorted()).toEqual(['age', 'extra', 'name']);
      expect(fields.extra).toEqual(['unrecognized_key']);
      expect(JSON.stringify(fields)).not.toContain('secret-value');
    }
  });

  it('parses a JSON body and refuses malformed or oversized ones', async () => {
    expect(await parseJsonBody(json('{"name":"a","age":1}'), schema)).toEqual({
      name: 'a',
      age: 1
    });
    await expect(parseJsonBody(json('{nope'), schema)).rejects.toMatchObject({
      fieldErrors: { '': ['invalid_json'] }
    });
    await expect(parseJsonBody(json('{"name":"a","age":1}'), schema, 5)).rejects.toMatchObject({
      fieldErrors: { '': ['too_big'] }
    });
  });

  it('parses query params, with repeated keys as arrays and a capped limit', () => {
    const q = z.strictObject({ limit: listLimitSchema, tag: z.array(z.string()).optional() });
    expect(parseSearchParams(new URL('http://x/?tag=a&tag=b&limit=25'), q)).toEqual({
      limit: 25,
      tag: ['a', 'b']
    });
    expect(parseSearchParams(new URLSearchParams(''), q).limit).toBe(50);
    expect(() => parseSearchParams(new URLSearchParams('limit=201'), q)).toThrow(ValidationError);
  });

  it('normalises emails and checks E.164 phones', () => {
    expect(emailSchema.parse('  Ann@Example.COM ')).toBe('ann@example.com');
    expect(e164Schema.safeParse('+15555550101').success).toBe(true);
    expect(e164Schema.safeParse('5555550101').success).toBe(false);
  });
});
