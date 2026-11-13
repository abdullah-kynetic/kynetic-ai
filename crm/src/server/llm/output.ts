export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

/** Reads one JSON object out of a model answer, tolerating a code fence or stray prose around it. */
export function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new LlmOutputError('The model did not return an object');
  try {
    const value: unknown = JSON.parse(candidate.slice(start, end + 1));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new LlmOutputError('The model returned malformed JSON');
}

/** One line of untrusted text, trimmed and cut to length. */
export function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Multi-line text, trimmed and cut to length. */
export function cleanBlock(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\r/g, '').trim().slice(0, max) : '';
}
