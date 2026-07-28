import { describe, expect, it } from 'vitest';
import { shouldEncodeResponseBodyBase64 } from './responseBodyEncoding.js';

/**
 * Encodes a string as UTF-8 bytes.
 *
 * @param text - Source string.
 */
function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('shouldEncodeResponseBodyBase64', () => {
  it('encodes image/* content types', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(shouldEncodeResponseBodyBase64('image/png', bytes)).toBe(true);
    expect(shouldEncodeResponseBodyBase64('image/jpeg; charset=binary', bytes)).toBe(true);
  });

  it('skips text/*, json, html, xml, javascript, and form-urlencoded', () => {
    const bytes = utf8('hello');
    expect(shouldEncodeResponseBodyBase64('text/plain', bytes)).toBe(false);
    expect(shouldEncodeResponseBodyBase64('text/csv', bytes)).toBe(false);
    expect(shouldEncodeResponseBodyBase64('application/json', utf8('{"a":1}'))).toBe(false);
    expect(shouldEncodeResponseBodyBase64('application/problem+json', utf8('{"a":1}'))).toBe(false);
    expect(shouldEncodeResponseBodyBase64('text/html', utf8('<html></html>'))).toBe(false);
    expect(shouldEncodeResponseBodyBase64('application/xml', utf8('<root/>'))).toBe(false);
    expect(shouldEncodeResponseBodyBase64('application/javascript', utf8('var x=1'))).toBe(false);
    expect(shouldEncodeResponseBodyBase64('application/x-www-form-urlencoded', utf8('a=1'))).toBe(
      false
    );
  });

  it('encodes known binary application types', () => {
    const pdf = utf8('%PDF-1.4 binary');
    expect(shouldEncodeResponseBodyBase64('application/pdf', pdf)).toBe(true);
    expect(shouldEncodeResponseBodyBase64('application/zip', new Uint8Array([0x50, 0x4b]))).toBe(
      true
    );
    expect(shouldEncodeResponseBodyBase64('audio/mpeg', new Uint8Array([0xff, 0xfb]))).toBe(true);
  });

  it('encodes octet-stream binary but keeps JSON or HTML-ish payloads as text', () => {
    expect(
      shouldEncodeResponseBodyBase64('application/octet-stream', new Uint8Array([0x00, 0x01, 0x02]))
    ).toBe(true);
    expect(shouldEncodeResponseBodyBase64('application/octet-stream', utf8('{"ok":true}'))).toBe(
      false
    );
    expect(
      shouldEncodeResponseBodyBase64(
        'application/octet-stream',
        utf8('<!DOCTYPE html><html><body></body></html>')
      )
    ).toBe(false);
  });

  it('treats empty content-type with null bytes as binary and plain ASCII as text', () => {
    expect(shouldEncodeResponseBodyBase64('', new Uint8Array([0x00, 0x01, 0x02]))).toBe(true);
    expect(shouldEncodeResponseBodyBase64('', utf8('plain ascii'))).toBe(false);
    expect(shouldEncodeResponseBodyBase64('', utf8('{"ok":true}'))).toBe(false);
  });
});
