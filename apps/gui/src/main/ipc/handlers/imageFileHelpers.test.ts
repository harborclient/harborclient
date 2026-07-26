import { describe, expect, it } from 'vitest';
import { parseDataUrl, resolveImageMime, sniffImageMime } from './imageFileHelpers';

describe('sniffImageMime', () => {
  it('detects PNG magic bytes', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(sniffImageMime(buffer)).toBe('image/png');
  });

  it('detects JPEG magic bytes', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(sniffImageMime(buffer)).toBe('image/jpeg');
  });

  it('returns null for unknown bytes', () => {
    expect(sniffImageMime(Buffer.from('not-an-image'))).toBeNull();
  });
});

describe('resolveImageMime', () => {
  it('falls back to the file extension when magic bytes are unknown', () => {
    expect(resolveImageMime(Buffer.from('plain'), '/tmp/photo.webp')).toBe('image/webp');
  });

  it('rejects non-images', () => {
    expect(() => resolveImageMime(Buffer.from('plain'), '/tmp/notes.txt')).toThrow(
      /not a recognized image/i
    );
  });
});

describe('parseDataUrl', () => {
  it('decodes a base64 data URL', () => {
    const result = parseDataUrl(`data:image/png;base64,${Buffer.from('hi').toString('base64')}`);
    expect(result.mime).toBe('image/png');
    expect(result.buffer.toString('utf8')).toBe('hi');
  });

  it('rejects invalid data URLs', () => {
    expect(() => parseDataUrl('not-a-data-url')).toThrow(/Invalid data URL/i);
  });
});
