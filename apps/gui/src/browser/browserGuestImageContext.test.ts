import { describe, expect, it } from 'vitest';

import {
  buildBlobSrcToDataUrlScript,
  classifyBrowserGuestImageSrc,
  deriveImageFileNameFromSrcUrl,
  isBrowserGuestImageContext
} from './browserGuestImageContext';

describe('classifyBrowserGuestImageSrc', () => {
  it('classifies http and https URLs', () => {
    expect(classifyBrowserGuestImageSrc('https://example.com/a.png')).toBe('http');
    expect(classifyBrowserGuestImageSrc('http://localhost:3000/img.jpg')).toBe('http');
  });

  it('classifies data and blob URLs', () => {
    expect(classifyBrowserGuestImageSrc('data:image/png;base64,abc')).toBe('data');
    expect(classifyBrowserGuestImageSrc('blob:https://example.com/uuid')).toBe('blob');
  });

  it('rejects empty and unsupported schemes', () => {
    expect(classifyBrowserGuestImageSrc('')).toBe('unsupported');
    expect(classifyBrowserGuestImageSrc('   ')).toBe('unsupported');
    expect(classifyBrowserGuestImageSrc('file:///tmp/a.png')).toBe('unsupported');
    expect(classifyBrowserGuestImageSrc('javascript:alert(1)')).toBe('unsupported');
  });
});

describe('deriveImageFileNameFromSrcUrl', () => {
  it('uses the last path segment for http(s) URLs', () => {
    expect(deriveImageFileNameFromSrcUrl('https://cdn.example.com/photos/cat.png')).toBe('cat.png');
    expect(deriveImageFileNameFromSrcUrl('https://example.com/a%20b.webp?x=1')).toBe('a b.webp');
  });

  it('falls back to image.png for data, blob, and empty sources', () => {
    expect(deriveImageFileNameFromSrcUrl('data:image/png;base64,abc')).toBe('image.png');
    expect(deriveImageFileNameFromSrcUrl('blob:https://example.com/uuid')).toBe('image.png');
    expect(deriveImageFileNameFromSrcUrl('')).toBe('image.png');
  });

  it('falls back when the URL path has no basename', () => {
    expect(deriveImageFileNameFromSrcUrl('https://example.com/')).toBe('image.png');
  });
});

describe('isBrowserGuestImageContext', () => {
  it('requires mediaType image and a non-empty srcURL', () => {
    expect(isBrowserGuestImageContext('image', 'https://example.com/a.png')).toBe(true);
    expect(isBrowserGuestImageContext('image', '  ')).toBe(false);
    expect(isBrowserGuestImageContext('none', 'https://example.com/a.png')).toBe(false);
    expect(isBrowserGuestImageContext('video', 'https://example.com/a.png')).toBe(false);
  });
});

describe('buildBlobSrcToDataUrlScript', () => {
  it('embeds the blob URL safely and returns an async expression', () => {
    const script = buildBlobSrcToDataUrlScript('blob:https://example.com/abc"def');
    expect(script).toContain('fetch("blob:https://example.com/abc\\"def")');
    expect(script).toContain('FileReader');
    expect(script.startsWith('(async () =>')).toBe(true);
  });
});
