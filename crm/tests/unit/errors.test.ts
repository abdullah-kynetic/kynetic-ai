import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AppError,
  ERROR_STATUS,
  RateLimitedError,
  ValidationError,
  errorResponse,
  setUnexpectedErrorReporter,
  toErrorResult
} from '@/server/errors';

describe('error shape (SECURITY 5.1)', () => {
  it('has exactly the ratified codes and statuses', () => {
    expect(ERROR_STATUS).toEqual({
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      MODULE_DISABLED: 403,
      NOT_FOUND: 404,
      VALIDATION_FAILED: 400,
      CONFLICT: 409,
      RATE_LIMITED: 429,
      PROVIDER_ERROR: 502,
      INTERNAL: 500
    });
  });

  it('serializes an AppError to { ok: false, error: { code, message } }', async () => {
    const res = errorResponse(new AppError('NOT_FOUND'));
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Not found.' }
    });
  });

  it('carries field paths for validation errors', () => {
    const { status, body } = toErrorResult(new ValidationError({ email: ['invalid_format'] }));
    expect(status).toBe(400);
    expect(body.error.fieldErrors).toEqual({ email: ['invalid_format'] });
  });

  it('sets Retry-After on a rate limit error', () => {
    const res = errorResponse(new RateLimitedError(12.2));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('13');
  });
});

describe('unexpected errors', () => {
  afterEach(() => setUnexpectedErrorReporter((e) => console.error('Unexpected error', e)));

  it('never leaks the raw message; logs it server-side', async () => {
    const report = vi.fn();
    setUnexpectedErrorReporter(report);
    const raw = new Error('duplicate key value violates unique constraint "users_email_key"');
    const res = errorResponse(raw);
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toContain('users_email_key');
    expect(JSON.parse(text).error.code).toBe('INTERNAL');
    expect(report).toHaveBeenCalledWith(raw);
  });
});
