import { describe, expect, it } from 'vitest';

import {
  hostnameFromExternalUrl,
  shouldSkipExternalLinkConfirm,
  trustExternalDomain
} from './externalLinkTrust';

describe('externalLinkTrust', () => {
  it('extracts a lowercased hostname from an absolute URL', () => {
    expect(
      hostnameFromExternalUrl(
        'https://Developer.Mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/content-type'
      )
    ).toBe('developer.mozilla.org');
  });

  it('returns null for invalid URLs', () => {
    expect(hostnameFromExternalUrl('not a url')).toBeNull();
  });

  it('skips confirmation when all domains are allowed', () => {
    expect(shouldSkipExternalLinkConfirm('https://example.com/a', true, [])).toBe(true);
  });

  it('skips confirmation for an enabled trusted domain', () => {
    expect(
      shouldSkipExternalLinkConfirm('https://developer.mozilla.org/docs', false, [
        { domain: 'developer.mozilla.org', enabled: true }
      ])
    ).toBe(true);
  });

  it('prompts again for a disabled trusted domain', () => {
    expect(
      shouldSkipExternalLinkConfirm('https://developer.mozilla.org/docs', false, [
        { domain: 'developer.mozilla.org', enabled: false }
      ])
    ).toBe(false);
  });

  it('trusts a domain by adding or replacing the registry row', () => {
    expect(trustExternalDomain([], 'Example.COM')).toEqual([
      { domain: 'example.com', enabled: true }
    ]);
    expect(trustExternalDomain([{ domain: 'example.com', enabled: false }], 'example.com')).toEqual(
      [{ domain: 'example.com', enabled: true }]
    );
  });
});
