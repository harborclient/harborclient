import { describe, expect, it } from 'vitest';
import {
  applyScriptAuthSet,
  applyScriptAuthUpdate,
  buildAuthHeaderValue,
  buildOAuthAuthHeaderValue,
  defaultAuth,
  defaultOAuth2Config,
  encodeBasicAuth,
  flattenAuthConfig,
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

  it('returns null for oauth2', () => {
    const auth = {
      ...defaultAuth(),
      type: 'oauth2' as const,
      oauth2: {
        ...defaultOAuth2Config(),
        tokenUrl: 'https://example.com/token',
        clientId: 'id',
        clientSecret: 'secret'
      }
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
      bearer: { token: 'tok' },
      oauth2: defaultOAuth2Config()
    };
    expect(normalizeAuth(auth)).toEqual(auth);
  });

  it('normalizes oauth2 auth config', () => {
    const auth = normalizeAuth({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        scope: 'read',
        audience: 'api',
        clientAuth: 'header'
      }
    });
    expect(auth.type).toBe('oauth2');
    expect(auth.oauth2).toEqual({
      tokenUrl: 'https://example.com/token',
      clientId: 'client',
      clientSecret: 'secret',
      scope: 'read',
      audience: 'api',
      clientAuth: 'header'
    });
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

  it('substitutes oauth2 credential fields', () => {
    const auth = {
      ...defaultAuth(),
      type: 'oauth2' as const,
      oauth2: {
        ...defaultOAuth2Config(),
        clientId: '{{client}}',
        clientSecret: '{{secret}}'
      }
    };
    const resolved = resolveAuthVariables(auth, (text) => {
      if (text === '{{client}}') return 'resolved-client';
      if (text === '{{secret}}') return 'resolved-secret';
      return text;
    });
    expect(resolved.oauth2.clientId).toBe('resolved-client');
    expect(resolved.oauth2.clientSecret).toBe('resolved-secret');
  });
});

describe('buildOAuthAuthHeaderValue', () => {
  it('returns Bearer header from token result', () => {
    expect(
      buildOAuthAuthHeaderValue({
        accessToken: 'abc123',
        tokenType: 'Bearer'
      })
    ).toBe('Bearer abc123');
  });

  it('returns null for unsafe tokens', () => {
    expect(
      buildOAuthAuthHeaderValue({
        accessToken: 'bad\r\nHeader: injected',
        tokenType: 'Bearer'
      })
    ).toBeNull();
  });
});

describe('flattenAuthConfig', () => {
  it('returns flat bearer shape', () => {
    const auth = {
      ...defaultAuth(),
      type: 'bearer' as const,
      bearer: { token: 'tok' }
    };
    expect(flattenAuthConfig(auth)).toEqual({ type: 'bearer', token: 'tok' });
  });

  it('returns flat basic shape', () => {
    const auth = {
      ...defaultAuth(),
      type: 'basic' as const,
      basic: { username: 'alice', password: 'secret' }
    };
    expect(flattenAuthConfig(auth)).toEqual({
      type: 'basic',
      username: 'alice',
      password: 'secret'
    });
  });

  it('returns flat oauth2 shape', () => {
    const auth = {
      ...defaultAuth(),
      type: 'oauth2' as const,
      oauth2: {
        ...defaultOAuth2Config(),
        tokenUrl: 'https://example.com/token',
        clientId: 'id',
        clientSecret: 'secret',
        scope: 'read',
        audience: 'api',
        clientAuth: 'header' as const
      }
    };
    expect(flattenAuthConfig(auth)).toEqual({
      type: 'oauth2',
      tokenUrl: 'https://example.com/token',
      clientId: 'id',
      clientSecret: 'secret',
      scope: 'read',
      audience: 'api',
      clientAuth: 'header'
    });
  });

  it('returns none shape', () => {
    expect(flattenAuthConfig(defaultAuth())).toEqual({ type: 'none' });
  });
});

describe('applyScriptAuthSet', () => {
  it('sets bearer token and preserves other credential stores', () => {
    const current = {
      ...defaultAuth(),
      type: 'basic' as const,
      basic: { username: 'alice', password: 'secret' }
    };
    const next = applyScriptAuthSet(current, { type: 'bearer', token: '{{idToken}}' });
    expect(next.type).toBe('bearer');
    expect(next.bearer.token).toBe('{{idToken}}');
    expect(next.basic.username).toBe('alice');
  });

  it('throws for invalid type', () => {
    expect(() => applyScriptAuthSet(defaultAuth(), { type: 'digest' })).toThrow(
      'Invalid auth type: digest'
    );
  });

  it('throws when input is not an object', () => {
    expect(() => applyScriptAuthSet(defaultAuth(), null)).toThrow(
      'auth.set requires an auth object'
    );
  });
});

describe('applyScriptAuthUpdate', () => {
  it('updates a single flat field', () => {
    const current = {
      ...defaultAuth(),
      type: 'bearer' as const,
      bearer: { token: 'old' }
    };
    const next = applyScriptAuthUpdate(current, 'token', '{{idToken}}');
    expect(next.bearer.token).toBe('{{idToken}}');
  });

  it('throws for invalid field', () => {
    expect(() => applyScriptAuthUpdate(defaultAuth(), 'invalid', 'x')).toThrow(
      'Invalid auth field: invalid'
    );
  });
});
