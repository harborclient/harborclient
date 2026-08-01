import { describe, expect, it } from 'vitest';
import type { LiveServer } from '@harborclient/core/types';
import {
  defaultLiveServerCorsSettings,
  normalizeLiveServerConfigFields
} from '@harborclient/core/types';
import { findLiveServer } from './findLiveServer';

/**
 * Builds a minimal saved live server for lookup tests.
 *
 * @param overrides - Identity fields to set.
 * @returns Fake {@link LiveServer} row.
 */
function makeServer(overrides: Pick<LiveServer, 'id' | 'uuid' | 'name'>): LiveServer {
  const fields = normalizeLiveServerConfigFields({});
  return {
    ...overrides,
    root: '/tmp',
    port: null,
    aliases: [],
    watch: false,
    cors: defaultLiveServerCorsSettings(),
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...fields
  };
}

describe('findLiveServer', () => {
  const servers = [
    makeServer({ id: 1, uuid: 'aaa-111', name: 'Echo Server' }),
    makeServer({ id: 2, uuid: 'bbb-222', name: 'Docs' })
  ];

  it('matches by uuid first', () => {
    expect(findLiveServer(servers, 'bbb-222')?.name).toBe('Docs');
  });

  it('matches by case-insensitive name', () => {
    expect(findLiveServer(servers, 'echo server')?.uuid).toBe('aaa-111');
  });

  it('returns undefined when missing', () => {
    expect(findLiveServer(servers, 'missing')).toBeUndefined();
  });
});
