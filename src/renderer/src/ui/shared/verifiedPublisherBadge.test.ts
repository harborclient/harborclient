import { describe, expect, it } from 'vitest';
import { verifiedPublisherAriaLabel } from '#/renderer/src/ui/shared/verifiedPublisherBadge';

describe('verifiedPublisherAriaLabel', () => {
  it('includes the publisher name when provided', () => {
    expect(verifiedPublisherAriaLabel('HarborClient')).toBe('Verified publisher: HarborClient');
  });

  it('falls back to unknown when the author is missing', () => {
    expect(verifiedPublisherAriaLabel(undefined)).toBe('Verified publisher: unknown');
  });
});
