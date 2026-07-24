import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it } from 'vitest';
import { TeamHubIdMap } from './TeamHubIdMap';
import { describeSqlite } from '#/test/nativeModules';

describeSqlite('TeamHubIdMap', () => {
  const cleanups: Array<() => void> = [];

  /**
   * Creates a fresh id map in a temporary directory for tests.
   */
  function createMap(): TeamHubIdMap {
    const dir = mkdtempSync(join(tmpdir(), 'harborclient-idmap-'));
    const map = new TeamHubIdMap(join(dir, 'team-hub-test.db'));
    map.init();
    cleanups.push(() => {
      map.close();
      rmSync(dir, { recursive: true, force: true });
    });
    return map;
  }

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it('returns the same local id for repeated server ids', () => {
    const map = createMap();
    const first = map.toLocalId('collection', '550e8400-e29b-41d4-a716-446655440000');
    const second = map.toLocalId('collection', '550e8400-e29b-41d4-a716-446655440000');
    expect(second).toBe(first);
  });

  it('assigns distinct local ids per entity type and server id', () => {
    const map = createMap();
    const collectionId = map.toLocalId('collection', '550e8400-e29b-41d4-a716-446655440000');
    const folderId = map.toLocalId('folder', '550e8400-e29b-41d4-a716-446655440000');
    const requestId = map.toLocalId('request', '660e8400-e29b-41d4-a716-446655440001');

    expect(folderId).not.toBe(collectionId);
    expect(requestId).not.toBe(collectionId);
  });

  it('round-trips server ids through toServerId', () => {
    const map = createMap();
    const serverId = '770e8400-e29b-41d4-a716-446655440002';
    const localId = map.toLocalId('collection', serverId);
    expect(map.toServerId('collection', localId)).toBe(serverId);
  });

  it('forget removes a mapping so a later toLocalId allocates a new local id', () => {
    const map = createMap();
    const serverId = '880e8400-e29b-41d4-a716-446655440003';
    const localId = map.toLocalId('collection', serverId);
    map.forget('collection', serverId);
    expect(map.toServerId('collection', localId)).toBeUndefined();
    const nextLocalId = map.toLocalId('collection', serverId);
    expect(nextLocalId).not.toBe(localId);
  });
});
