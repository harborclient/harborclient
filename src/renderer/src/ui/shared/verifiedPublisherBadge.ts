/**
 * Builds the accessible name for a verified plugin publisher badge.
 *
 * @param author - Publisher name from the signature or manifest.
 * @returns Label announced by screen readers for the verification icon.
 */
export function verifiedPublisherAriaLabel(author: string | undefined): string {
  return `Verified publisher: ${author ?? 'unknown'}`;
}
