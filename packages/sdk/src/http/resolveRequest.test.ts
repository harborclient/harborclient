import { describe, expect, it } from 'vitest';
import { resolveRequest } from './resolveRequest.js';
import { substituteVariables } from './substitute.js';

describe('substituteVariables', () => {
  it('replaces known placeholders', () => {
    expect(substituteVariables('{{host}}/api', { host: 'https://example.com' })).toBe(
      'https://example.com/api'
    );
  });
});

describe('resolveRequest', () => {
  const emptyOAuth2 = {
    tokenUrl: '',
    clientId: '',
    clientSecret: '',
    scope: '',
    audience: '',
    clientAuth: 'body' as const
  };

  it('merges collection auth and variables', () => {
    const context = {
      draft: {
        method: 'POST',
        url: '{{base}}/users',
        params: [{ key: 'page', value: '1', enabled: true }],
        headers: [{ key: 'X-Test', value: '1', enabled: true }],
        body: '{"ok":true}',
        auth: {
          type: 'none' as const,
          basic: { username: '', password: '' },
          bearer: { token: '' },
          oauth2: emptyOAuth2
        },
        body_type: 'json' as const
      },
      response: null,
      readOnly: true as const,
      collectionAuth: {
        type: 'bearer' as const,
        basic: { username: '', password: '' },
        bearer: { token: '{{token}}' },
        oauth2: emptyOAuth2
      },
      collectionHeaders: [{ key: 'Accept', value: 'application/json', enabled: true }],
      variables: { base: 'https://api.test', token: 'secret' },
      requestKey: 'POST https://api.test/users'
    };
    const resolved = resolveRequest(context);
    expect(resolved.url).toBe('https://api.test/users?page=1');
    expect(resolved.headers.Authorization).toBe('Bearer secret');
    expect(resolved.headers['Content-Type']).toBe('application/json');
  });

  it('does not set Authorization for oauth2 auth', () => {
    const context = {
      draft: {
        method: 'GET',
        url: 'https://api.test/resource',
        params: [],
        headers: [],
        body: '',
        auth: {
          type: 'oauth2' as const,
          basic: { username: '', password: '' },
          bearer: { token: '' },
          oauth2: {
            tokenUrl: 'https://auth.example/token',
            clientId: 'cid',
            clientSecret: 'csecret',
            scope: 'read',
            audience: '',
            clientAuth: 'body' as const
          }
        },
        body_type: 'none' as const
      },
      response: null,
      readOnly: true as const,
      collectionAuth: {
        type: 'none' as const,
        basic: { username: '', password: '' },
        bearer: { token: '' },
        oauth2: emptyOAuth2
      },
      collectionHeaders: [],
      variables: {},
      requestKey: 'GET https://api.test/resource'
    };
    const resolved = resolveRequest(context);
    expect(resolved.headers.Authorization).toBeUndefined();
  });
});
