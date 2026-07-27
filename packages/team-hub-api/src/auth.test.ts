import { describe, expect, it } from 'vitest';
import { defaultAuth } from './appTypes.js';
import { toTeamHubAuth } from './auth.js';
import { adminResourceOptionSchema, collectionRecordSchema } from './schemas.js';

describe('toTeamHubAuth', () => {
  it('strips oauth2 fields and downgrades the type to none', () => {
    const auth = defaultAuth();
    auth.type = 'oauth2';
    auth.oauth2.tokenUrl = 'https://example.com/token';

    expect(toTeamHubAuth(auth)).toEqual({
      type: 'none',
      basic: { username: '', password: '' },
      bearer: { token: '' }
    });
  });

  it('preserves basic and bearer auth modes', () => {
    const auth = defaultAuth();
    auth.type = 'bearer';
    auth.bearer.token = 'secret';

    expect(toTeamHubAuth(auth)).toEqual({
      type: 'bearer',
      basic: { username: '', password: '' },
      bearer: { token: 'secret' }
    });
  });
});

describe('collectionRecordSchema', () => {
  it('accepts Team Hub collection records without oauth2 auth', () => {
    const parsed = collectionRecordSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Shared API',
      variables: [],
      headers: [],
      auth: {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' }
      },
      preRequestScript: '',
      postRequestScript: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      deletionLocked: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1'
    });

    expect(parsed.success).toBe(true);
  });

  it('defaults deletionLocked to false when omitted by older hub versions', () => {
    const parsed = collectionRecordSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Shared API',
      variables: [],
      headers: [],
      auth: {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' }
      },
      preRequestScript: '',
      postRequestScript: '',
      createdAt: '2026-01-01T00:00:00.000Z'
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.deletionLocked).toBe(false);
    }
  });

  it('accepts optional sidebar marker on collection records', () => {
    const parsed = collectionRecordSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Shared API',
      variables: [],
      headers: [],
      auth: {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' }
      },
      preRequestScript: '',
      postRequestScript: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      deletionLocked: false,
      marker: '#ff5500'
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.marker).toBe('#ff5500');
    }
  });
});

describe('adminResourceOptionSchema', () => {
  it('defaults deletionLocked to false for legacy admin list entries', () => {
    const parsed = adminResourceOptionSchema.safeParse({
      id: 'c-1',
      name: 'Shared API'
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.deletionLocked).toBe(false);
    }
  });
});
