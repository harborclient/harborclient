import { describe, expect, it } from 'vitest';
import { formatResponseBody } from './formatResponseBody';

describe('formatResponseBody', () => {
  it('passes through unchanged when pretty is off', () => {
    expect(formatResponseBody('{"ok":true}', false)).toBe('{"ok":true}\n');
  });

  it('preserves an existing trailing newline when pretty is off', () => {
    expect(formatResponseBody('hello\n', false)).toBe('hello\n');
  });

  it('returns an empty body unchanged when pretty is off', () => {
    expect(formatResponseBody('', false)).toBe('');
  });

  it('pretty-prints a JSON object', () => {
    expect(formatResponseBody('{"ok":true,"n":1}', true)).toBe('{\n  "ok": true,\n  "n": 1\n}\n');
  });

  it('pretty-prints a JSON array', () => {
    expect(formatResponseBody('[1,2]', true)).toBe('[\n  1,\n  2\n]\n');
  });

  it('passes through invalid JSON when pretty is on', () => {
    expect(formatResponseBody('not json', true)).toBe('not json\n');
  });

  it('returns an empty body unchanged when pretty is on', () => {
    expect(formatResponseBody('', true)).toBe('');
  });

  it('re-serializes already-pretty JSON via parse and stringify', () => {
    const input = '{\n  "a": 1\n}';
    expect(formatResponseBody(input, true)).toBe('{\n  "a": 1\n}\n');
  });
});
