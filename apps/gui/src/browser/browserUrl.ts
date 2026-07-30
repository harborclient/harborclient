/**
 * Protocols allowed for embedded browser navigation and address-bar loads.
 */
const ALLOWED_BROWSER_PROTOCOLS = new Set(['http:', 'https:', 'about:']);

/**
 * Returns whether a URL is safe to load in an embedded browser guest.
 *
 * Allows http, https, and about:blank only. Rejects file, custom schemes,
 * javascript, and malformed URLs.
 *
 * @param url - Candidate navigation or address-bar URL.
 * @returns True when the guest may navigate to this URL.
 */
export function isAllowedBrowserUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (!ALLOWED_BROWSER_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  if (parsed.protocol === 'about:') {
    return parsed.href === 'about:blank' || parsed.pathname === 'blank';
  }

  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * Normalizes user address-bar input into a loadable URL.
 *
 * Bare hostnames get an https:// prefix. Returns null when the result is not
 * an allowed browser URL.
 *
 * @param input - Raw address-bar text.
 * @returns Absolute URL string, or null when invalid/disallowed.
 */
export function normalizeBrowserAddressInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === 'about:blank') {
    return 'about:blank';
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    candidate = `https://${trimmed}`;
  }

  if (!isAllowedBrowserUrl(candidate)) {
    return null;
  }

  try {
    return new URL(candidate).href;
  } catch {
    return null;
  }
}

/**
 * Returns whether two browser URLs refer to the same page for tab matching.
 *
 * Both sides are normalized the same way as address-bar input. Comparison is
 * exact on the resulting absolute href (including pathname, query, and hash).
 *
 * @param left - First URL (for example a tab's current url).
 * @param right - Second URL (for example a webpage_tab argument).
 * @returns True when both normalize to the same allowed href.
 */
export function browserUrlsMatch(left: string, right: string): boolean {
  const a = normalizeBrowserAddressInput(left);
  const b = normalizeBrowserAddressInput(right);
  if (!a || !b) {
    return false;
  }
  return a === b;
}
