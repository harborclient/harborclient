import { describe, expect, it } from 'vitest';
import {
  FaviconCache,
  absoluteFaviconHref,
  bytesToFaviconDataUrl,
  candidatesFromChromiumFavicons,
  candidatesFromScrapedLinks,
  defaultFaviconIcoUrl,
  faviconCacheKeyForUrl,
  isAcceptableFaviconContentType,
  isFaviconEligibleUrl,
  parseFaviconSizes,
  rankFaviconCandidates,
  scoreFaviconCandidate
} from './browserFavicon';

describe('isFaviconEligibleUrl', () => {
  it('allows http and https only', () => {
    expect(isFaviconEligibleUrl('https://example.com/path')).toBe(true);
    expect(isFaviconEligibleUrl('http://localhost:3000')).toBe(true);
    expect(isFaviconEligibleUrl('about:blank')).toBe(false);
    expect(isFaviconEligibleUrl('file:///tmp')).toBe(false);
  });
});

describe('faviconCacheKeyForUrl', () => {
  it('returns the origin for http(s) pages', () => {
    expect(faviconCacheKeyForUrl('https://example.com/a/b?q=1')).toBe('https://example.com');
  });

  it('returns null for about:blank', () => {
    expect(faviconCacheKeyForUrl('about:blank')).toBeNull();
  });
});

describe('defaultFaviconIcoUrl', () => {
  it('builds origin/favicon.ico', () => {
    expect(defaultFaviconIcoUrl('https://example.com/page')).toBe(
      'https://example.com/favicon.ico'
    );
  });
});

describe('parseFaviconSizes', () => {
  it('returns the smallest declared size', () => {
    expect(parseFaviconSizes('32x32 16x16')).toBe(16);
  });

  it('returns undefined for any or empty', () => {
    expect(parseFaviconSizes('any')).toBeUndefined();
    expect(parseFaviconSizes('')).toBeUndefined();
  });
});

describe('scoreFaviconCandidate', () => {
  it('prefers shortcut icon and small sizes over apple-touch', () => {
    const shortcut = scoreFaviconCandidate({
      href: 'https://a/favicon.ico',
      rel: 'shortcut icon',
      size: 16
    });
    const apple = scoreFaviconCandidate({
      href: 'https://a/apple.png',
      rel: 'apple-touch-icon',
      size: 180
    });
    expect(shortcut).toBeLessThan(apple);
  });
});

describe('absoluteFaviconHref', () => {
  it('resolves relative hrefs against the page URL', () => {
    expect(absoluteFaviconHref('/icon.png', 'https://example.com/path/')).toBe(
      'https://example.com/icon.png'
    );
  });

  it('preserves data URLs', () => {
    expect(absoluteFaviconHref('data:image/png;base64,aa', 'https://example.com/')).toBe(
      'data:image/png;base64,aa'
    );
  });

  it('rejects non-http schemes', () => {
    expect(absoluteFaviconHref('javascript:alert(1)', 'https://example.com/')).toBeNull();
  });
});

describe('rankFaviconCandidates', () => {
  it('orders by preference and deduplicates', () => {
    const ranked = rankFaviconCandidates(
      [
        { href: 'https://example.com/apple.png', rel: 'apple-touch-icon', size: 180 },
        { href: '/favicon.ico', rel: 'icon', size: 16 },
        { href: 'https://example.com/favicon.ico', rel: 'shortcut icon', size: 16 }
      ],
      'https://example.com/page'
    );
    expect(ranked[0]).toBe('https://example.com/favicon.ico');
    expect(ranked).toHaveLength(2);
  });
});

describe('candidatesFromChromiumFavicons', () => {
  it('ranks Chromium URL lists', () => {
    const ranked = candidatesFromChromiumFavicons(
      ['https://example.com/large.png', 'https://example.com/small.ico'],
      'https://example.com/'
    );
    expect(ranked).toContain('https://example.com/small.ico');
    expect(ranked).toHaveLength(2);
  });
});

describe('candidatesFromScrapedLinks', () => {
  it('prefers small rel=icon over apple-touch', () => {
    const ranked = candidatesFromScrapedLinks(
      [
        { href: '/apple-touch-icon.png', rel: 'apple-touch-icon', sizes: '180x180' },
        { href: '/favicon-32.png', rel: 'icon', sizes: '32x32' }
      ],
      'https://example.com/'
    );
    expect(ranked[0]).toBe('https://example.com/favicon-32.png');
  });
});

describe('isAcceptableFaviconContentType', () => {
  it('accepts images and octet-stream', () => {
    expect(isAcceptableFaviconContentType('image/png')).toBe(true);
    expect(isAcceptableFaviconContentType('application/octet-stream')).toBe(true);
    expect(isAcceptableFaviconContentType('text/html')).toBe(false);
  });
});

describe('bytesToFaviconDataUrl', () => {
  it('encodes PNG magic as a data URL', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const dataUrl = bytesToFaviconDataUrl(pngHeader);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('FaviconCache', () => {
  it('returns cached values until TTL expires', () => {
    let now = 1_000;
    const cache = new FaviconCache(100, () => now);
    cache.set('https://example.com', 'data:image/png;base64,abc');
    expect(cache.get('https://example.com')).toBe('data:image/png;base64,abc');
    now = 1_050;
    expect(cache.get('https://example.com')).toBe('data:image/png;base64,abc');
    now = 1_101;
    expect(cache.get('https://example.com')).toBeNull();
  });
});
