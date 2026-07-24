import { describe, expect, it } from 'vitest';
import type { RedirectHop } from '#/shared/types';
import {
  formatRedirectChain,
  formatRedirectHopLine,
  getFinalRedirectUrl
} from './redirectsDisplay';

describe('redirectsDisplay', () => {
  const hopA: RedirectHop = {
    status: 302,
    statusText: 'Found',
    url: 'https://example.com/start',
    location: 'https://example.com/hop1',
    method: 'GET'
  };

  const hopB: RedirectHop = {
    status: 301,
    statusText: 'Moved Permanently',
    url: 'https://example.com/hop1',
    location: 'https://example.com/final',
    method: 'GET'
  };

  it('returns the last hop location as the final redirect URL', () => {
    expect(getFinalRedirectUrl([hopA, hopB])).toBe('https://example.com/final');
  });

  it('formats each hop with method, URLs, and status', () => {
    expect(formatRedirectHopLine(hopA)).toBe(
      'GET https://example.com/start → https://example.com/hop1 (302 Found)'
    );
    expect(formatRedirectHopLine(hopB)).toBe(
      'GET https://example.com/hop1 → https://example.com/final (301 Moved Permanently)'
    );
  });

  it('formats the full chain including the final destination line', () => {
    expect(formatRedirectChain([hopA, hopB])).toBe(
      [
        'GET https://example.com/start → https://example.com/hop1 (302 Found)',
        'GET https://example.com/hop1 → https://example.com/final (301 Moved Permanently)',
        'Final destination: https://example.com/final'
      ].join('\n')
    );
  });
});
