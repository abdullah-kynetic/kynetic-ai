// The one error shape for route handlers and server actions (SECURITY 5.1, CODE_STYLE Errors).
// Body: { ok: false, error: { code, message, fieldErrors? } }. The code list is closed: no other
// codes without amending SECURITY 5.1.

export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  MODULE_DISABLED: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PROVIDER_ERROR: 502,
  INTERNAL: 500
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** Field path to machine-readable reasons. Paths and reasons only, never the submitted values. */
export type FieldErrors = Record<string, string[]>;

export type ErrorBody = {
  ok: false;
  error: { code: ErrorCode; message: string; fieldErrors?: FieldErrors };
};

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Sign in to continue.',
  FORBIDDEN: 'You do not have access to this.',
  MODULE_DISABLED: 'This feature is not enabled for your account.',
  NOT_FOUND: 'Not found.',
  VALIDATION_FAILED: 'Some fields are not valid.',
  CONFLICT: 'This conflicts with the current state. Refresh and try again.',
  RATE_LIMITED: 'Too many requests. Try again shortly.',
  PROVIDER_ERROR: 'An outside service failed. Try again shortly.',
  INTERNAL: 'Something went wrong on our side.'
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;
  /** Extra response headers, such as Retry-After. */
  readonly headers: Record<string, string>;

  constructor(
    code: ErrorCode,
    opts: {
      message?: string;
      fieldErrors?: FieldErrors;
      headers?: Record<string, string>;
      cause?: unknown;
    } = {}
  ) {
    super(opts.message ?? DEFAULT_MESSAGES[code], { cause: opts.cause });
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = opts.fieldErrors;
    this.headers = opts.headers ?? {};
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export class ValidationError extends AppError {
  constructor(fieldErrors: FieldErrors) {
    super('VALIDATION_FAILED', { fieldErrors });
    this.name = 'ValidationError';
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    const wait = Math.max(1, Math.ceil(retryAfterSeconds));
    super('RATE_LIMITED', { headers: { 'Retry-After': String(wait) } });
    this.name = 'RateLimitedError';
    this.retryAfterSeconds = wait;
  }
}

export function errorBody(code: ErrorCode, message?: string, fieldErrors?: FieldErrors): ErrorBody {
  return {
    ok: false,
    error: {
      code,
      message: message ?? DEFAULT_MESSAGES[code],
      ...(fieldErrors ? { fieldErrors } : {})
    }
  };
}

type Reporter = (err: unknown) => void;

// Detail goes to the server log, never to the client. The structured logger (logger.ts) replaces
// this default when it lands.
let reportUnexpected: Reporter = (err) => {
  console.error('Unexpected error', err);
};

export function setUnexpectedErrorReporter(fn: Reporter): void {
  reportUnexpected = fn;
}

/**
 * Maps anything thrown to the standard body. An AppError keeps its code; every other value
 * (database errors, provider errors, bugs) becomes INTERNAL with a fixed message.
 */
export function toErrorResult(err: unknown): {
  status: number;
  body: ErrorBody;
  headers: Record<string, string>;
} {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: errorBody(err.code, err.message, err.fieldErrors),
      headers: err.headers
    };
  }
  reportUnexpected(err);
  return { status: 500, body: errorBody('INTERNAL'), headers: {} };
}

export function errorResponse(err: unknown): Response {
  const { status, body, headers } = toErrorResult(err);
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers }
  });
}
