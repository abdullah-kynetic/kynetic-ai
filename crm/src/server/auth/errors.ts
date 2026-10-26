export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  readonly status = 403;
  constructor(message = 'You do not have access to this.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
