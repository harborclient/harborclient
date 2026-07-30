import { describe, expect, it } from 'vitest';
import { resolveBrowserAddressInput } from './resolveBrowserAddress';

describe('resolveBrowserAddressInput', () => {
  it('substitutes variables in an absolute URL', () => {
    expect(resolveBrowserAddressInput('https://{{host}}/x', { host: 'example.com' })).toBe(
      'https://example.com/x'
    );
  });

  it('substitutes a bare host variable then prefixes https', () => {
    expect(resolveBrowserAddressInput('{{host}}', { host: 'example.com' })).toBe(
      'https://example.com/'
    );
  });

  it('returns null when unresolved tokens remain after substitution', () => {
    expect(resolveBrowserAddressInput('https://{{missing}}/x', {})).toBeNull();
  });

  it('returns null for disallowed schemes after substitution', () => {
    expect(resolveBrowserAddressInput('{{scheme}}://example.com', { scheme: 'file' })).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(resolveBrowserAddressInput('', {})).toBeNull();
  });

  it('preserves about:blank', () => {
    expect(resolveBrowserAddressInput('about:blank', {})).toBe('about:blank');
  });
});
