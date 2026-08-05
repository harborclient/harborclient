import { describe, expect, it, vi } from 'vitest';
import type { RoutingStorage } from '#/main/storage/RoutingStorage';
import type { TeamHub } from '@harborclient/core/types';
import { resyncUserTeamHubsSharingServer } from './teamHubCollectionResync';

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
  it('syncs all mounted hubs on the same server URL including the admin hub', async () => {
    const router = createRouterMock(['hub-admin', 'hub-user', 'hub-other']);

    await resyncUserTeamHubsSharingServer(router as RoutingStorage, adminHub.id, [
      adminHub,
      userHub,
      otherServerHub
    ]);

    expect(router.syncTeamHub).toHaveBeenCalledTimes(2);
    expect(router.syncTeamHub).toHaveBeenCalledWith('hub-admin');
    expect(router.syncTeamHub).toHaveBeenCalledWith('hub-user');
    expect(router.syncTeamHub).not.toHaveBeenCalledWith('hub-other');
  });

  it('skips unmounted hubs on the same server', async () => {
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

    expect(router.syncTeamHub).not.toHaveBeenCalled();
  });
});
