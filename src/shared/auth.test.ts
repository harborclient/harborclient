import { describe, expect, it } from 'vitest';
import {
  buildAuthHeaderValue,
  defaultAuth,
  encodeBasicAuth,
  normalizeAuth,
  resolveAuthVariables
} from '#/shared/auth';

describe('encodeBasicAuth', () => {
  it('encodes ASCII credentials', () => {
    expect(encodeBasicAuth('user', 'pass')).toBe('dXNlcjpwYXNz');
  });

  it('encodes unicode credentials as UTF-8', () => {
    expect(encodeBasicAuth('user', 'päss')).toBe('dXNlcjpww6Rzcw==');
  });
});

describe('buildAuthHeaderValue', () => {
  it('returns null for none', () => {
    expect(buildAuthHeaderValue(defaultAuth())).toBeNull();
  });

  it('returns Basic header when username or password is set', () => {
    const auth = {
      ...defaultAuth(),
      type: 'basic' as const,
      basic: { username: 'alice', password: 'secret' }
    };
    expect(buildAuthHeaderValue(auth)).toBe(`Basic ${encodeBasicAuth('alice', 'secret')}`);
  });

  it('returns null for basic when credentials are empty', () => {
    const auth = { ...defaultAuth(), type: 'basic' as const };
    expect(buildAuthHeaderValue(auth)).toBeNull();
  });

  it('returns Bearer header when token is set', () => {
    const auth = {
      ...defaultAuth(),
      type: 'bearer' as const,
      bearer: { token: 'abc123' }
    };
    expect(buildAuthHeaderValue(auth)).toBe('Bearer abc123');
  });

  it('returns null for bearer when token is blank', () => {
    const auth = { ...defaultAuth(), type: 'bearer' as const, bearer: { token: '   ' } };
    expect(buildAuthHeaderValue(auth)).toBeNull();
  });

  it('returns null for bearer when token contains control characters', () => {
    const auth = {
      ...defaultAuth(),
      type: 'bearer' as const,
      bearer: { token: 'abc\r\nX-Injected: evil' }
    };
    expect(buildAuthHeaderValue(auth)).toBeNull();
  });
});

describe('normalizeAuth', () => {
  it('returns default for invalid input', () => {
    expect(normalizeAuth(null)).toEqual(defaultAuth());
    expect(normalizeAuth('invalid')).toEqual(defaultAuth());
  });

  it('preserves valid auth config', () => {
    const auth = {
      type: 'bearer',
      basic: { username: 'u', password: 'p' },
      bearer: { token: 'tok' }
    };
    expect(normalizeAuth(auth)).toEqual(auth);
  });
});

describe('resolveAuthVariables', () => {
  it('substitutes credential fields', () => {
    const auth = {
      ...defaultAuth(),
      type: 'bearer' as const,
      bearer: { token: '{{token}}' }
    };
    const resolved = resolveAuthVariables(auth, (text) =>
      text === '{{token}}' ? 'resolved' : text
    );
    expect(resolved.bearer.token).toBe('resolved');
  });
});
