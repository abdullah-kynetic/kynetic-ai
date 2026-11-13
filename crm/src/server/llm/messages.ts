import { ProviderError } from '@/server/adapters/errors';
import { AppError } from '@/server/errors';
import { LlmCapReachedError } from '.';
import { LlmOutputError } from './output';

/** Plain words for a failed model feature, for the page that asked. Unknown errors are not hidden. */
export function describeLlmFailure(error: unknown): string | null {
  if (error instanceof LlmCapReachedError) {
    return "This client's monthly AI allowance is used up, so no more AI requests will run this month. Kynetic has been told.";
  }
  if (error instanceof LlmOutputError) {
    return 'The AI answer could not be used. Try again, or write it yourself.';
  }
  if (error instanceof ProviderError) {
    if (
      error.code === 'llm_disabled' ||
      error.code === 'llm_not_configured' ||
      error.code === 'no_model'
    ) {
      return 'AI help is not switched on yet.';
    }
    return 'The AI service did not answer. Try again in a minute.';
  }
  if (error instanceof AppError && error.code === 'VALIDATION_FAILED') return error.message;
  return null;
}
