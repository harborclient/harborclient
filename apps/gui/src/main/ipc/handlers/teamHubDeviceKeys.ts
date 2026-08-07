import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import {
  enrollTeamHubDevice,
  getTeamHubDeviceEnrollmentStatus,
  listAdminTeamHubDeviceKeys,
  resetTeamHubDeviceKeys,
  revokeAdminTeamHubDeviceKey
} from '#/main/settings/teamHubDeviceEnrollment';

/**
 * Registers IPC handlers for Team Hub device key enrollment and admin revocation.
 */
export function registerTeamHubDeviceKeyHandlers(): void {
  handle(
    'teamHubs:getDeviceEnrollmentStatus',
    ipcArgSchemas.connectionId,
    async (_event, hubId) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      return getTeamHubDeviceEnrollmentStatus(hub);
    }
  );

  handle(
    'teamHubs:enrollDevice',
    ipcArgSchemas.teamHubDeviceEnroll,
    async (_event, hubId, label) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      return enrollTeamHubDevice(hub, label);
    }
  );

  handle('teamHubs:resetDeviceKeys', ipcArgSchemas.teamHubDeviceReset, async (_event, hubId) => {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (!hub) {
      throw new Error(`Unknown team hub: ${hubId}`);
    }

    await resetTeamHubDeviceKeys(hub, true);
  });

  handle('teamHubs:listDeviceKeys', ipcArgSchemas.teamHubDeviceList, async (_event, hubId) => {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (!hub) {
      throw new Error(`Unknown team hub: ${hubId}`);
    }

    return listAdminTeamHubDeviceKeys(hub);
  });

  handle(
    'teamHubs:revokeDeviceKey',
    ipcArgSchemas.teamHubDeviceRevoke,
    async (_event, hubId, deviceKeyId) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      await revokeAdminTeamHubDeviceKey(hub, deviceKeyId);
    }
  );
}
