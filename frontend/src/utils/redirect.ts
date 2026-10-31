/**
 * Validates and normalizes internal redirect paths to prevent open redirect vulnerabilities.
 */
export function normalizePath(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean;
}

export function getSafeInternalRedirect(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const trimmed = pathOrUrl.trim();
  // Reject external URLs, scheme indicators, protocol-relative '//', or backslash tricks
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.includes(':')) {
    return null;
  }
  const normalized = normalizePath(trimmed);
  // Disallow redirecting directly back into auth entry pages
  if (['/login', '/signup', '/verify-email', '/auth/callback', '/reset-password', '/forgot-password'].includes(normalized)) {
    return null;
  }
  return normalized;
}
