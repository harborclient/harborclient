import { describe, expect, it } from 'vitest';
import { methodBadgeClass } from './sidebarItemClasses.js';

describe('methodBadgeClass', () => {
  it('returns per-method color classes when method colors are enabled', () => {
    expect(methodBadgeClass('GET')).toBe('hc-method-badge text-method-get');
    expect(methodBadgeClass('post', true)).toBe('hc-method-badge text-method-post');
  });

  it('returns neutral theme text when method colors are disabled', () => {
    expect(methodBadgeClass('GET', false)).toBe('hc-method-badge text-text');
    expect(methodBadgeClass('DELETE', false)).toBe('hc-method-badge text-text');
  });

  it('falls back to neutral text for unknown methods when colors are enabled', () => {
    expect(methodBadgeClass('CUSTOM')).toBe('hc-method-badge text-text');
  });
});
