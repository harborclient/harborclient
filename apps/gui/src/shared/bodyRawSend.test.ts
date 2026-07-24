import { describe, expect, it } from 'vitest';
import { applyBodyRawOverride, ensureRawBodyContentType } from './bodyRawSend';
import type { SendRequestInput } from '@harborclient/http';

/**
 * Builds a minimal send input for tests.
 *
 * @param overrides - Partial fields to merge.
 * @returns SendRequestInput fixture.
 */
function baseInput(overrides: Partial<SendRequestInput> = {}): SendRequestInput {
  return {
    method: 'POST',
    url: 'https://example.com',
    headers: [],
    params: [],
    body: '[]',
    bodyType: 'urlencoded',
    ...overrides
  };
}

describe('ensureRawBodyContentType', () => {
  it('adds urlencoded Content-Type when missing', () => {
    expect(ensureRawBodyContentType([], 'a=1', 'urlencoded')).toEqual([
      {
        key: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
        enabled: true
      }
    ]);
  });

  it('adds multipart Content-Type with detected boundary when missing', () => {
    const raw = '--abc\r\nContent-Disposition: form-data; name="a"\r\n\r\nx\r\n--abc--';
    expect(ensureRawBodyContentType([], raw, 'multipart')).toEqual([
      {
        key: 'Content-Type',
        value: 'multipart/form-data; boundary=abc',
        enabled: true
      }
    ]);
  });

  it('leaves existing Content-Type alone', () => {
    const headers = [{ key: 'Content-Type', value: 'text/plain', enabled: true }];
    expect(ensureRawBodyContentType(headers, 'a=1', 'urlencoded')).toBe(headers);
  });
});

describe('applyBodyRawOverride', () => {
  it('returns the input unchanged when override is inactive', () => {
    const input = baseInput();
    expect(applyBodyRawOverride(input, null, 'urlencoded')).toBe(input);
    expect(applyBodyRawOverride(input, undefined, 'urlencoded')).toBe(input);
  });

  it('sets bodyRaw for empty-string overrides so invalid empty bodies can be sent', () => {
    const result = applyBodyRawOverride(baseInput(), '', 'urlencoded');
    expect(result.bodyRaw).toBe('');
    expect(result.headers).toEqual([
      {
        key: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
        enabled: true
      }
    ]);
  });

  it('passes invalid urlencoded text through unchanged', () => {
    const result = applyBodyRawOverride(baseInput(), '%%%not=valid&', 'urlencoded');
    expect(result.bodyRaw).toBe('%%%not=valid&');
  });
});
