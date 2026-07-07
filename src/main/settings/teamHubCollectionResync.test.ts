import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoutingStorage } from '#/main/storage/RoutingStorage';
import type { TeamHub } from '#/shared/types';
import { resyncUserTeamHubsSharingServer } from '#/main/settings/teamHubCollectionResync';

vi.mock('#/main/settings/teamHubSessionScan', () => ({
  scanTeamHubSessions: vi.fn()
}));

import { scanTeamHubSessions } from '#/main/settings/teamHubSessionScan';

beforeEach(() => {
  vi.mocked(scanTeamHubSessions).mockReset();
});

const adminHub: TeamHub = {
  id: 'hub-admin',
  name: 'Admin',
  baseUrl: 'https://hub.example.com/',
  token: 'hbk_admin'
};

const userHub: TeamHub = {
  id: 'hub-user',
  name: 'User',
  baseUrl: 'https://hub.example.com',
  token: 'hbk_user'
};

const otherServerHub: TeamHub = {
  id: 'hub-other',
  name: 'Other',
  baseUrl: 'https://other.example.com',
  token: 'hbk_other'
};

/**
 * Builds a minimal RoutingStorage mock for resync tests.
 *
 * @param mountedHubIds - Hub connection ids reported as mounted.
 */
function createRouterMock(
  mountedHubIds: string[]
): Pick<RoutingStorage, 'isConnectionMounted' | 'syncTeamHub'> {
  const mounted = new Set(mountedHubIds);
  return {
    isConnectionMounted: vi.fn((hubId: string) => mounted.has(hubId)),
    syncTeamHub: vi.fn().mockResolvedValue(undefined)
  };
}

describe('resyncUserTeamHubsSharingServer', () => {
  it('syncs mounted user hubs on the same server URL', async () => {
    vi.mocked(scanTeamHubSessions).mockResolvedValue([
      {
        hubId: 'hub-admin',
        managementApi: true,
        services: { storage: true, llm: false, pluginCatalog: false, snippets: false, admin: true }
      },
      {
        hubId: 'hub-user',
        managementApi: false,
        services: { storage: true, llm: false, pluginCatalog: false, snippets: false, admin: false }
      },
      {
        hubId: 'hub-other',
        managementApi: false,
        services: { storage: true, llm: false, pluginCatalog: false, snippets: false, admin: false }
      }
    ]);

    const router = createRouterMock(['hub-user', 'hub-other']);

    await resyncUserTeamHubsSharingServer(router as RoutingStorage, adminHub.id, [
      adminHub,
      userHub,
      otherServerHub
    ]);

    expect(router.syncTeamHub).toHaveBeenCalledTimes(1);
    expect(router.syncTeamHub).toHaveBeenCalledWith('hub-user');
  });

  it('skips admin hubs and unmounted user hubs', async () => {
    vi.mocked(scanTeamHubSessions).mockResolvedValue([
      {
        hubId: 'hub-admin',
        managementApi: true,
        services: { storage: true, llm: false, pluginCatalog: false, snippets: false, admin: true }
      },
      {
        hubId: 'hub-user',
        managementApi: false,
        services: { storage: true, llm: false, pluginCatalog: false, snippets: false, admin: false }
      }
    ]);

    const router = createRouterMock([]);

    await resyncUserTeamHubsSharingServer(router as RoutingStorage, adminHub.id, [
      adminHub,
      userHub
    ]);

    expect(router.syncTeamHub).not.toHaveBeenCalled();
  });

  it('no-ops when the admin hub id is unknown', async () => {
    const router = createRouterMock(['hub-user']);

    await resyncUserTeamHubsSharingServer(router as RoutingStorage, 'missing', [userHub]);

    expect(scanTeamHubSessions).not.toHaveBeenCalled();
    expect(router.syncTeamHub).not.toHaveBeenCalled();
  });
});
