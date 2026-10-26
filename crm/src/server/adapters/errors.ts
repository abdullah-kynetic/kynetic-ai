export type ProviderErrorKind = 'transient' | 'permanent' | 'config';

/** Normalised provider failure so retry policy is shared across vendors. */
export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
