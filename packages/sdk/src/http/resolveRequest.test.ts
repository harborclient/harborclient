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
          bearer: { token: '' }
        },
        body_type: 'json' as const
      },
      response: null,
      readOnly: true as const,
      collectionAuth: {
        type: 'bearer' as const,
        basic: { username: '', password: '' },
        bearer: { token: '{{token}}' }
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
});
