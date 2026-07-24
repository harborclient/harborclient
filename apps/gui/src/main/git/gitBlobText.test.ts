import { describe, expect, it } from 'vitest';
import { decodeBlobText, decodeTextContent, isBinaryContent } from './gitBlobText';

describe('gitBlobText', () => {
  describe('isBinaryContent', () => {
    it('returns false for UTF-8 text bytes', () => {
      const text = new TextEncoder().encode('{"url":"v1"}');

      expect(isBinaryContent(text)).toBe(false);
    });

    it('returns true when the sample contains a NUL byte', () => {
      const binary = Uint8Array.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x21]);

      expect(isBinaryContent(binary)).toBe(true);
    });
  });

  describe('decodeBlobText', () => {
    it('returns undefined for an absent blob', () => {
      expect(decodeBlobText(null)).toBeUndefined();
    });

    it('returns an empty string for zero-length bytes', () => {
      expect(decodeBlobText(new Uint8Array())).toBe('');
    });

    it('returns decoded UTF-8 text for textual content', () => {
      const text = new TextEncoder().encode('hello');

      expect(decodeBlobText(text)).toBe('hello');
    });

    it('returns null for binary content', () => {
      const binary = Uint8Array.from([0, 1, 2, 3]);

      expect(decodeBlobText(binary)).toBeNull();
    });
  });

  describe('decodeTextContent', () => {
    it('returns an empty string for an absent blob', () => {
      expect(decodeTextContent(null)).toBe('');
    });

    it('returns null for binary content', () => {
      const binary = Uint8Array.from([0, 1, 2, 3]);

      expect(decodeTextContent(binary)).toBeNull();
    });

    it('returns decoded UTF-8 text for textual content', () => {
      const text = new TextEncoder().encode('hello');

      expect(decodeTextContent(text)).toBe('hello');
    });
  });
});
