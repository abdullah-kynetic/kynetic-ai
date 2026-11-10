/** Where a signed-in client goes when the terms gate is on. Staff are exempt. The flag defaults off. */
export function termsRedirectTarget(input: {
  enabled: boolean;
  staff: boolean;
  pending: boolean;
  path: string;
}): string | null {
  if (!input.enabled || input.staff || !input.pending) return null;
  if (input.path.startsWith('/terms/accept')) return null;
  const next = safeNextPath(input.path);
  return `/terms/accept?next=${encodeURIComponent(next)}`;
}

/**
 * A path on this site only. Rejects other origins, protocol-relative URLs, and backslashes.
 * The fallback is the dashboard.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return '/dashboard';
  const value = raw.trim();
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.includes('://')
  )
    return '/dashboard';
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return '/dashboard';
  }
  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    decoded.includes('://') ||
    decoded.includes('\0')
  )
    return '/dashboard';
  const pathOnly = decoded.split('?')[0] ?? '';
  if (pathOnly.includes('..')) return '/dashboard';
  if (decoded.startsWith('/terms/accept')) return '/dashboard';
  return decoded;
}
