import { describe, expect, it } from 'vitest';
import {
  detectMultipartBoundary,
  generateMultipartBoundary,
  multipartFileToken,
  multipartRawContentType,
  multipartRawHasFileTokens,
  parseMultipartRaw,
  renderMultipartRaw
} from './multipartRaw';
import type { FormDataPart } from '#/shared/types/common';

/**
 * Builds a text form part for tests.
 *
 * @param key - Field name.
 * @param value - Field value.
 * @returns Enabled text FormDataPart.
 */
function textPart(key: string, value: string): FormDataPart {
  return { key, value, enabled: true, type: 'text', files: [] };
}

/**
 * Builds a file form part for tests.
 *
 * @param key - Field name.
 * @param files - Absolute file paths.
 * @returns Enabled file FormDataPart.
 */
function filePart(key: string, files: string[]): FormDataPart {
  return { key, value: '', enabled: true, type: 'file', files };
}

describe('generateMultipartBoundary', () => {
  it('returns a Harbor-prefixed boundary string', () => {
    expect(generateMultipartBoundary()).toMatch(/^----HarborFormBoundary/);
  });
});

describe('multipartFileToken / multipartRawHasFileTokens', () => {
  it('builds and detects path-embedded file tokens', () => {
    const token = multipartFileToken('/tmp/avatar.jpg');
    expect(token).toBe('<<file:/tmp/avatar.jpg>>');
    expect(multipartRawHasFileTokens(`x\n${token}\ny`)).toBe(true);
    expect(multipartRawHasFileTokens('no tokens here')).toBe(false);
  });
});

describe('renderMultipartRaw / parseMultipartRaw', () => {
  it('round-trips text parts', () => {
    const boundary = 'testBoundary';
    const parts = [textPart('note', 'hello'), textPart('count', '2')];
    const raw = renderMultipartRaw(parts, boundary);
    expect(raw).toContain('--testBoundary');
    expect(raw).toContain('name="note"');
    expect(raw).toContain('hello');
    expect(raw.endsWith('--testBoundary--')).toBe(true);

    const parsed = parseMultipartRaw(raw);
    expect(parsed.representable).toBe(true);
    expect(parsed.boundary).toBe(boundary);
    expect(parsed.parts).toEqual(parts);
  });

  it('embeds absolute paths as file tokens and restores them on parse', () => {
    const boundary = 'fileBoundary';
    const parts = [filePart('avatar', ['/abs/path/avatar.jpg'])];
    const raw = renderMultipartRaw(parts, boundary);
    expect(raw).toContain('filename="avatar.jpg"');
    expect(raw).toContain('<<file:/abs/path/avatar.jpg>>');

    const parsed = parseMultipartRaw(raw);
    expect(parsed.representable).toBe(true);
    expect(parsed.parts).toEqual(parts);
  });

  it('skips disabled and blank-key parts when rendering', () => {
    const raw = renderMultipartRaw(
      [
        { key: 'a', value: '1', enabled: false, type: 'text', files: [] },
        { key: '', value: 'x', enabled: true, type: 'text', files: [] },
        textPart('ok', 'yes')
      ],
      'b'
    );
    expect(raw).toContain('name="ok"');
    expect(raw).not.toContain('name="a"');
  });

  it('returns empty string / empty parts for empty input', () => {
    expect(renderMultipartRaw([], 'b')).toBe('');
    expect(parseMultipartRaw('')).toEqual({ parts: [], representable: true });
  });

  it('marks malformed input as non-representable without throwing', () => {
    const parsed = parseMultipartRaw('not multipart at all');
    expect(parsed.representable).toBe(false);
    expect(parsed.parts).toEqual([]);
  });

  it('detects boundary and builds Content-Type', () => {
    const text = '--abc\r\nContent-Disposition: form-data; name="a"\r\n\r\nx\r\n--abc--';
    expect(detectMultipartBoundary(text)).toBe('abc');
    expect(multipartRawContentType(text)).toBe('multipart/form-data; boundary=abc');
    expect(multipartRawContentType('nope')).toBe('multipart/form-data');
  });
});
