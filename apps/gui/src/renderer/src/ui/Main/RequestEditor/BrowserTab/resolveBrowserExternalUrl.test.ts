import { describe, expect, it } from 'vitest';
import { resolveBrowserExternalUrl } from './resolveBrowserExternalUrl';

describe('resolveBrowserExternalUrl', () => {
  it('returns an absolute https URL', () => {
    expect(resolveBrowserExternalUrl('https://example.com/path', {})).toBe(
      'https://example.com/path'
    );
  });

  it('prefixes https for a bare host', () => {
    expect(resolveBrowserExternalUrl('example.com', {})).toBe('https://example.com/');
  });

  it('substitutes variables then returns http(s)', () => {
    expect(resolveBrowserExternalUrl('https://{{host}}/x', { host: 'example.com' })).toBe(
      'https://example.com/x'
    );
  });

  it('returns null for about:blank', () => {
    expect(resolveBrowserExternalUrl('about:blank', {})).toBeNull();
  });

  it('returns null for view-source URLs', () => {
    expect(resolveBrowserExternalUrl('view-source:https://example.com', {})).toBeNull();
  });

  it('returns null when unresolved tokens remain', () => {
    expect(resolveBrowserExternalUrl('https://{{missing}}/x', {})).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(resolveBrowserExternalUrl('', {})).toBeNull();
  });
});
