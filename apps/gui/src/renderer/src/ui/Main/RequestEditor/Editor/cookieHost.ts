/**
 * Extracts a hostname from a URL string, with a fallback for host-only values.
 *
 * @param url - Absolute or partial URL.
 * @returns Hostname when parseable, otherwise null.
 */
export function hostFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).hostname || null;
  } catch {
    try {
      return new URL(`https://${trimmed}`).hostname || null;
    } catch {
      return null;
    }
  }
}
