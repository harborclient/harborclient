import type { RedirectHop } from '#/shared/types';

/**
 * Returns the final destination URL after the last recorded redirect hop.
 *
 * @param redirects - Ordered redirect hops from the send result.
 */
export function getFinalRedirectUrl(redirects: RedirectHop[]): string | undefined {
  if (redirects.length === 0) {
    return undefined;
  }
  return redirects[redirects.length - 1]?.location;
}

/**
 * Builds a single-line summary for one redirect hop (used in copy/export and tests).
 *
 * @param hop - One redirect hop from the send result.
 */
export function formatRedirectHopLine(hop: RedirectHop): string {
  return `${hop.method} ${hop.url} → ${hop.location} (${hop.status} ${hop.statusText})`;
}

/**
 * Builds a multi-line summary of the full redirect chain.
 *
 * @param redirects - Ordered redirect hops from the send result.
 */
export function formatRedirectChain(redirects: RedirectHop[]): string {
  const lines = redirects.map((hop) => formatRedirectHopLine(hop));
  const finalUrl = getFinalRedirectUrl(redirects);
  if (finalUrl) {
    lines.push(`Final destination: ${finalUrl}`);
  }
  return lines.join('\n');
}
