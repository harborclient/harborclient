import { describe, expect, it } from 'vitest';
import { applyBrowserAddressPaste } from './applyBrowserAddressPaste';

describe('applyBrowserAddressPaste', () => {
  it('replaces the selected range with the pasted text', () => {
    expect(applyBrowserAddressPaste('https://old.example', 8, 11, 'new')).toBe(
      'https://new.example'
    );
  });

  it('inserts at the caret when the selection is collapsed', () => {
    expect(applyBrowserAddressPaste('https://', 8, 8, 'example.com')).toBe('https://example.com');
  });

  it('appends when selection offsets are unknown', () => {
    expect(applyBrowserAddressPaste('https://', null, null, 'example.com')).toBe(
      'https://example.com'
    );
  });
});
