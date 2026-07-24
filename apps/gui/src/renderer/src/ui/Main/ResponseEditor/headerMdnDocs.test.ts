import { describe, expect, it } from 'vitest';
import { headerMdnDocsUrl } from './headerMdnDocs';

describe('headerMdnDocsUrl', () => {
  it('builds the MDN URL for a standard header name', () => {
    expect(headerMdnDocsUrl('content-type')).toBe(
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/content-type'
    );
  });

  it('preserves mixed-case custom header names in the URL path', () => {
    expect(headerMdnDocsUrl('X-Custom-Header')).toBe(
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Custom-Header'
    );
  });

  it('trims whitespace before encoding the header name', () => {
    expect(headerMdnDocsUrl('  content-type  ')).toBe(
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/content-type'
    );
  });
});
