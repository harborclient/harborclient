import { describe, expect, it } from 'vitest';
import { hasEchoScriptReturnValue, resolveEchoResponseBody } from './resolveEchoResponseBody';

const defaultEcho = {
  args: { foo: 'bar' },
  data: '',
  files: {},
  form: {},
  headers: { host: 'localhost:3000' },
  json: null,
  origin: '127.0.0.1',
  url: 'http://localhost:3000/?foo=bar'
};

describe('resolveEchoResponseBody', () => {
  it('returns the script value when defined', () => {
    expect(resolveEchoResponseBody({ custom: true }, defaultEcho)).toEqual({ custom: true });
  });

  it('returns default echo when script value is undefined', () => {
    expect(resolveEchoResponseBody(undefined, defaultEcho)).toEqual(defaultEcho);
  });

  it('returns default echo when script value is null', () => {
    expect(resolveEchoResponseBody(null, defaultEcho)).toEqual(defaultEcho);
  });
});

describe('hasEchoScriptReturnValue', () => {
  it('treats undefined and null as absent', () => {
    expect(hasEchoScriptReturnValue(undefined)).toBe(false);
    expect(hasEchoScriptReturnValue(null)).toBe(false);
  });

  it('treats other values including empty objects as present', () => {
    expect(hasEchoScriptReturnValue({})).toBe(true);
    expect(hasEchoScriptReturnValue('')).toBe(true);
    expect(hasEchoScriptReturnValue(0)).toBe(true);
  });
});
