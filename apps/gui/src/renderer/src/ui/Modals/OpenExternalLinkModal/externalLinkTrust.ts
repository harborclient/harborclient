import type { TrustedExternalDomain } from '@harborclient/core/types';

/**
 * Extracts a normalized hostname from an absolute URL.
 *
 * @param url - Absolute http(s) URL.
 * @returns Lowercased hostname, or null when the URL is invalid.
 */
export function hostnameFromExternalUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.trim().toLowerCase();
    return hostname.length > 0 ? hostname : null;
  } catch {
    return null;
  }
}

/**
 * Returns whether an external URL may open without showing the confirmation modal.
 *
 * @param url - Absolute URL the user is opening.
 * @param allowAllExternalDomains - When true, every domain is allowed.
 * @param trustedExternalDomains - Per-domain trust registry.
 */
export function shouldSkipExternalLinkConfirm(
  url: string,
  allowAllExternalDomains: boolean,
  trustedExternalDomains: readonly TrustedExternalDomain[]
): boolean {
  if (allowAllExternalDomains) {
    return true;
  }

  const hostname = hostnameFromExternalUrl(url);
  if (!hostname) {
    return false;
  }

  return trustedExternalDomains.some((entry) => entry.domain === hostname && entry.enabled);
}

/**
 * Inserts or updates a trusted domain as enabled, preserving other rows.
 *
 * @param trustedExternalDomains - Current registry.
 * @param domain - Hostname to trust.
 * @returns Updated registry with the domain enabled.
 */
export function trustExternalDomain(
  trustedExternalDomains: readonly TrustedExternalDomain[],
  domain: string
): TrustedExternalDomain[] {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) {
    return [...trustedExternalDomains];
  }

  const next = trustedExternalDomains.filter((entry) => entry.domain !== normalized);
  next.push({ domain: normalized, enabled: true });
  return next;
}
