/**
 * A same-origin path a person may return to after sign-in. Rejects protocol-relative
 * and off-site values so the query string cannot be an open redirect.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return null;
  let url: URL;
  try {
    url = new URL(value, 'http://localhost');
  } catch {
    return null;
  }
  if (url.origin !== 'http://localhost') return null;
  if (!url.pathname.startsWith('/') || url.pathname.startsWith('//')) return null;
  return `${url.pathname}${url.search}`;
}

/** A top-level browser navigation, not an API or fetch call. */
export function isHtmlNavigation(input: {
  method: string;
  accept: string | null;
  fetchDest: string | null;
}): boolean {
  if (input.method !== 'GET' && input.method !== 'HEAD') return false;
  if (input.fetchDest === 'document' || input.fetchDest === 'iframe') return true;
  if (input.fetchDest) return false;
  return (input.accept ?? '').includes('text/html');
}
