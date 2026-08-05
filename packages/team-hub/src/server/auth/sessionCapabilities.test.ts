import { describe, expect, it } from 'vitest';
import type { ApiTokenRecord, UserRecord } from '#/db/types.js';
import { buildSessionPayload } from '#/server/auth/sessionCapabilities.js';
import { sampleAttribution } from '#/server/routes/test/sampleAttribution.js';

const baseUser: UserRecord = {
  id: 'user-1',
  name: 'Alice',
  role: 'user',
  collectionAccess: ['collection-1'],
  environmentAccess: ['*'],
  snippetAccess: [],
  liveServerAccess: [],
  livePageAccess: [],

  llmAccess: true,
  llmModels: ['gpt-4o'],
  llmMonthlyTokenLimit: 100_000,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...sampleAttribution
};

const baseToken: ApiTokenRecord = {
  id: 'token-1',
  userId: baseUser.id,
  name: 'Laptop',
  tokenHash: 'hash',
  tokenPrefix: 'hbk_AbCd1234',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null,
  ...sampleAttribution
};

describe('buildSessionPayload', () => {
  it('maps user-role accounts to data and LLM capabilities', () => {
    expect(buildSessionPayload(baseUser, baseToken, '__default__')).toEqual({
      user: {
        id: 'user-1',
        name: 'Alice',
        role: 'user'
      },
      token: {
        id: 'token-1',
        prefix: 'hbk_AbCd1234'
      },
      capabilities: {
        dataApi: true,
        managementApi: false,
        llm: true
      },
      tenantId: '__default__'
    });
  });

  it('maps admin-role accounts to data and management capabilities', () => {
    const adminUser: UserRecord = {
      ...baseUser,
      role: 'admin',
      collectionAccess: [],
      environmentAccess: [],
      snippetAccess: [],

      llmAccess: false
    };

    expect(buildSessionPayload(adminUser, baseToken, '__default__')).toEqual({
      user: {
        id: 'user-1',
        name: 'Alice',
        role: 'admin'
      },
      token: {
        id: 'token-1',
        prefix: 'hbk_AbCd1234'
      },
      capabilities: {
        dataApi: true,
        managementApi: true,
        llm: false
      },
      tenantId: '__default__'
    });
  });

  it('grants LLM capability for admin accounts when llmAccess is enabled', () => {
    const adminUser: UserRecord = {
      ...baseUser,
      role: 'admin',
      collectionAccess: [],
      environmentAccess: [],
      snippetAccess: [],

      llmAccess: true,
      llmModels: ['*']
    };

    expect(buildSessionPayload(adminUser, baseToken, '__default__').capabilities.llm).toBe(true);
  });
});
