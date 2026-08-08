import { describe, expect, it } from 'vitest';
import {
  basenameFromPath,
  deriveFileName,
  hashForDedupeKey,
  imageViewSourceKey,
  normalizePersistedImageViewPageRef,
  pageRefFromOpenImageViewPayload,
  shortenFileName,
  toDataUrl
} from './imageViewHelpers';

describe('basenameFromPath', () => {
  it('returns the last path segment for unix and windows paths', () => {
    expect(basenameFromPath('/tmp/photos/shot.png')).toBe('shot.png');
    expect(basenameFromPath('C:\\Users\\sean\\shot.png')).toBe('shot.png');
  });
});

describe('shortenFileName', () => {
  it('returns short names unchanged', () => {
    expect(shortenFileName('logo.png')).toBe('logo.png');
  });

  it('middle-ellipses long names while preserving the extension', () => {
    expect(shortenFileName('screenshot-2024-01-15-at-midnight.png', 24)).toBe(
      'screenshot…-midnight.png'
    );
  });

  it('falls back when there is no extension budget', () => {
    expect(shortenFileName('abcdefghijklmnop', 8)).toBe('abcd…nop');
  });
});

describe('deriveFileName', () => {
  it('prefers an explicit fileName', () => {
    expect(deriveFileName({ path: '/tmp/a.png', fileName: 'Custom.png' })).toBe('Custom.png');
  });

  it('uses the path basename when fileName is omitted', () => {
    expect(deriveFileName({ path: '/tmp/photos/shot.png' })).toBe('shot.png');
  });

  it('uses the last URL path segment when fileName is omitted', () => {
    expect(deriveFileName({ url: 'https://example.com/assets/logo.png?x=1' })).toBe('logo.png');
  });

  it('falls back to Image when nothing else is available', () => {
    expect(deriveFileName({ url: 'https://example.com/' })).toBe('Image');
  });
});

describe('toDataUrl', () => {
  it('wraps bare base64 with the content type', () => {
    expect(toDataUrl('abc', 'image/png')).toBe('data:image/png;base64,abc');
  });

  it('passes through existing data URLs', () => {
    expect(toDataUrl('data:image/gif;base64,xyz', 'image/png')).toBe('data:image/gif;base64,xyz');
  });
});

describe('pageRefFromOpenImageViewPayload', () => {
  it('builds a path page ref', () => {
    const page = pageRefFromOpenImageViewPayload({ path: '/tmp/shot.png' });
    expect(page).toEqual({
      type: 'image-view',
      fileName: 'shot.png',
      shortLabel: 'shot.png',
      source: { kind: 'path', path: '/tmp/shot.png' }
    });
  });

  it('builds a url page ref', () => {
    const page = pageRefFromOpenImageViewPayload({
      url: 'https://example.com/logo.png',
      fileName: 'Logo'
    });
    expect(page.source).toEqual({ kind: 'url', url: 'https://example.com/logo.png' });
    expect(page.fileName).toBe('Logo');
  });

  it('builds a data page ref from base64', () => {
    const page = pageRefFromOpenImageViewPayload({
      base64: 'abc',
      contentType: 'image/png',
      fileName: 'chart.png'
    });
    expect(page.source).toEqual({ kind: 'data', dataUrl: 'data:image/png;base64,abc' });
    expect(page.shortLabel).toBe('chart.png');
  });

  it('rejects empty payloads', () => {
    expect(() => pageRefFromOpenImageViewPayload({})).toThrow(/exactly one/i);
  });

  it('rejects ambiguous payloads', () => {
    expect(() =>
      pageRefFromOpenImageViewPayload({ path: '/a.png', url: 'https://example.com/a.png' })
    ).toThrow(/exactly one/i);
  });
});

describe('imageViewSourceKey', () => {
  it('uses path and url values directly', () => {
    expect(imageViewSourceKey({ kind: 'path', path: '/tmp/a.png' })).toBe('/tmp/a.png');
    expect(imageViewSourceKey({ kind: 'url', url: 'https://x/y' })).toBe('https://x/y');
  });

  it('hashes data URLs for stable keys', () => {
    const key = imageViewSourceKey({ kind: 'data', dataUrl: 'data:image/png;base64,abc' });
    expect(key).toBe(hashForDedupeKey('data:image/png;base64,abc'));
    expect(key.length).toBeGreaterThan(0);
  });
});

describe('normalizePersistedImageViewPageRef', () => {
  it('restores path, url, and data sources', () => {
    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: 'shot.png',
        shortLabel: 'shot.png',
        source: { kind: 'path', path: '/tmp/shot.png' }
      })
    ).toEqual({
      type: 'image-view',
      fileName: 'shot.png',
      shortLabel: 'shot.png',
      source: { kind: 'path', path: '/tmp/shot.png' }
    });

    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: 'logo.png',
        shortLabel: 'logo.png',
        source: { kind: 'url', url: 'https://example.com/logo.png' }
      })
    ).toEqual({
      type: 'image-view',
      fileName: 'logo.png',
      shortLabel: 'logo.png',
      source: { kind: 'url', url: 'https://example.com/logo.png' }
    });

    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: 'chart.png',
        shortLabel: 'chart.png',
        source: { kind: 'data', dataUrl: 'data:image/png;base64,abc' }
      })
    ).toEqual({
      type: 'image-view',
      fileName: 'chart.png',
      shortLabel: 'chart.png',
      source: { kind: 'data', dataUrl: 'data:image/png;base64,abc' }
    });
  });

  it('derives shortLabel from fileName when shortLabel is missing', () => {
    const page = normalizePersistedImageViewPageRef({
      type: 'image-view',
      fileName: 'screenshot-2024-01-15-at-midnight.png',
      source: { kind: 'path', path: '/tmp/shot.png' }
    });
    expect(page?.shortLabel).toBe(shortenFileName('screenshot-2024-01-15-at-midnight.png'));
  });

  it('rejects missing or empty required fields', () => {
    expect(normalizePersistedImageViewPageRef(null)).toBeNull();
    expect(normalizePersistedImageViewPageRef({ type: 'cookies' })).toBeNull();
    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: '   ',
        source: { kind: 'path', path: '/tmp/a.png' }
      })
    ).toBeNull();
    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: 'a.png',
        source: { kind: 'path', path: '' }
      })
    ).toBeNull();
    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: 'a.png',
        source: { kind: 'url', url: '   ' }
      })
    ).toBeNull();
    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: 'a.png',
        source: { kind: 'data', dataUrl: '' }
      })
    ).toBeNull();
    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: 'a.png',
        source: { kind: 'blob', dataUrl: 'data:image/png;base64,abc' }
      })
    ).toBeNull();
    expect(
      normalizePersistedImageViewPageRef({
        type: 'image-view',
        fileName: 'a.png',
        source: { kind: 'data' }
      })
    ).toBeNull();
  });
});
