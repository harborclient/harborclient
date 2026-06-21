import { describe, expect, it } from 'vitest';
import {
  hasUnsafeHeaderFieldChars,
  validateHeaderField,
  validateHeaders
} from '#/shared/httpHeaders';

describe('hasUnsafeHeaderFieldChars', () => {
  it('returns false for printable ASCII text', () => {
    expect(hasUnsafeHeaderFieldChars('Authorization')).toBe(false);
    expect(hasUnsafeHeaderFieldChars('Bearer abc-123')).toBe(false);
  });

  it('returns true for control characters and DEL', () => {
    expect(hasUnsafeHeaderFieldChars('a\u0000b')).toBe(true);
    expect(hasUnsafeHeaderFieldChars('a\u001fb')).toBe(true);
    expect(hasUnsafeHeaderFieldChars('a\u007fb')).toBe(true);
  });

  it('returns true for CR and LF', () => {
    expect(hasUnsafeHeaderFieldChars('a\rb')).toBe(true);
    expect(hasUnsafeHeaderFieldChars('a\nb')).toBe(true);
    expect(hasUnsafeHeaderFieldChars('a\r\nInjected: evil')).toBe(true);
  });
});

describe('validateHeaderField', () => {
  it('accepts normal header names and values', () => {
    expect(validateHeaderField('X-Custom', 'value')).toBeNull();
    expect(validateHeaderField('Authorization', 'Bearer token')).toBeNull();
  });

  it('rejects hop-by-hop headers case-insensitively', () => {
    expect(validateHeaderField('Connection', 'close')).toBe('Forbidden header: Connection');
    expect(validateHeaderField('transfer-encoding', 'chunked')).toBe(
      'Forbidden header: transfer-encoding'
    );
  });

  it('rejects control characters in names and values', () => {
    expect(validateHeaderField('X-Bad\nName', 'ok')).toBe(
      'Invalid header name: control characters are not allowed'
    );
    expect(validateHeaderField('X-Test', 'bad\r\nvalue')).toBe(
      'Invalid header value for "X-Test": control characters are not allowed'
    );
  });
});

describe('validateHeaders', () => {
  it('returns null for a valid header map', () => {
    expect(
      validateHeaders({
        Authorization: 'Bearer abc',
        'X-Custom': '1'
      })
    ).toBeNull();
  });

  it('returns the first validation error', () => {
    expect(
      validateHeaders({
        Connection: 'close',
        'X-Test': 'ok'
      })
    ).toBe('Forbidden header: Connection');
  });
});
