import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { setTeamHubConnected } from './teamHubConnectionState';
import { deleteTeamHub, listConnectedTeamHubs, listTeamHubs, saveTeamHub } from './teamHubSettings';

describe('teamHubSettings', () => {
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    settingsStore = {};
    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalDatabase;
    setLocalDatabaseForTesting(database);
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
  });

  it('returns an empty list when unset', () => {
    expect(listTeamHubs()).toEqual([]);
  });

  it('creates a team hub with a generated id and normalized base URL', () => {
    const saved = saveTeamHub({
      id: '',
      name: ' Team Hub ',
      baseUrl: 'http://127.0.0.1:8788/',
      token: ' hbk_test '
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('Team Hub');
    expect(saved[0]?.baseUrl).toBe('http://127.0.0.1:8788');
    expect(saved[0]?.token).toBe('hbk_test');
    expect(saved[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(JSON.parse(settingsStore.teamHubs ?? '[]')).toEqual([
      {
        id: saved[0]?.id,
        name: 'Team Hub',
        baseUrl: 'http://127.0.0.1:8788'
      }
    ]);
    expect(settingsStore.teamHubSecrets).toBeTruthy();
  });

  it('persists tenantId when provided', () => {
    const saved = saveTeamHub({
      id: '',
      name: 'Team Hub',
      baseUrl: 'http://127.0.0.1:8788',
      token: 'hbk_test',
      tenantId: 'tenant-123'
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]?.tenantId).toBe('tenant-123');
    expect(JSON.parse(settingsStore.teamHubs ?? '[]')).toEqual([
      {
        id: saved[0]?.id,
        name: 'Team Hub',
        baseUrl: 'http://127.0.0.1:8788',
        tenantId: 'tenant-123'
      }
    ]);
  });

  it('normalizes blank tenantId to undefined', () => {
    const saved = saveTeamHub({
      id: '',
      name: 'Team Hub',
      baseUrl: 'http://127.0.0.1:8788',
      token: 'hbk_test',
      tenantId: '  '
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]?.tenantId).toBeUndefined();
    expect(JSON.parse(settingsStore.teamHubs ?? '[]')).toEqual([
      {
        id: saved[0]?.id,
        name: 'Team Hub',
        baseUrl: 'http://127.0.0.1:8788'
      }
    ]);
  });

  it('updates an existing team hub by id', () => {
    const created = saveTeamHub({
      id: '',
      name: 'Original',
      baseUrl: 'http://127.0.0.1:8788',
      token: 'hbk_old'
    });
    const id = created[0]?.id ?? '';

    saveTeamHub({
      id,
      name: 'Updated',
      baseUrl: 'https://hub.example.com/',
      token: 'hbk_new'
    });

    expect(listTeamHubs()).toEqual([
      {
        id,
        name: 'Updated',
        baseUrl: 'https://hub.example.com',
        token: 'hbk_new',
        connected: true
      }
    ]);
  });

  it('deletes a team hub by id', () => {
    const first = saveTeamHub({
      id: '',
      name: 'First',
      baseUrl: 'http://127.0.0.1:8788',
      token: 'hbk_one'
    });
    const second = saveTeamHub({
      id: '',
      name: 'Second',
      baseUrl: 'http://127.0.0.1:8789',
      token: 'hbk_two'
    });
    const firstId = first[0]?.id ?? '';
    const secondId = second[1]?.id ?? '';

    const remaining = deleteTeamHub(firstId);

    expect(remaining).toEqual([
      {
        id: secondId,
        name: 'Second',
        baseUrl: 'http://127.0.0.1:8789',
        token: 'hbk_two',
        connected: true
      }
    ]);
  });

  it('throws when deleting an unknown team hub', () => {
    expect(() => deleteTeamHub('missing-id')).toThrow('Unknown team hub: missing-id');
  });

  it('lists only soft-connected hubs from listConnectedTeamHubs', () => {
    const created = saveTeamHub({
      id: '',
      name: 'Connected Hub',
      baseUrl: 'http://127.0.0.1:8788',
      token: 'hbk_one'
    });
    const other = saveTeamHub({
      id: '',
      name: 'Disconnected Hub',
      baseUrl: 'http://127.0.0.1:8789',
      token: 'hbk_two'
    });
    const connectedId = created[0]?.id ?? '';
    const disconnectedId = other[1]?.id ?? '';

    setTeamHubConnected(disconnectedId, false);

    expect(listConnectedTeamHubs().map((hub) => hub.id)).toEqual([connectedId]);
    expect(listTeamHubs().find((hub) => hub.id === disconnectedId)?.connected).toBe(false);
  });
});
