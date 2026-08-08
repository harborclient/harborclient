import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { createTeamHubClient } from '#/main/settings/teamHubClient';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import type { UpdateMyAvatarInput as TeamHubApiUpdateMyAvatarInput } from '@harborclient/team-hub-api';

/**
 * Returns a Team Hub client for the given hub connection id.
 *
 * @param hubId - Local Team Hub connection id.
 */
function requireTeamHubClient(hubId: string): ReturnType<typeof createTeamHubClient> {
  const hub = listTeamHubs().find((entry) => entry.id === hubId);
  if (hub == null) {
    throw new Error('Team Hub connection not found');
  }
  return createTeamHubClient(hub);
}

/**
 * Registers IPC handlers for authenticated Team Hub profile avatar routes.
 */
export function registerTeamHubProfileHandlers(): void {
  handle(
    'teamHubs:updateMyAvatar',
    ipcArgSchemas.teamHubUpdateMyAvatar,
    async (_event, hubId, input) => {
      const client = requireTeamHubClient(hubId);
      return client.updateMyAvatar(input as TeamHubApiUpdateMyAvatarInput);
    }
  );

  handle(
    'teamHubs:getUserAvatar',
    ipcArgSchemas.teamHubGetUserAvatar,
    async (_event, hubId, userId, version) => {
      const client = requireTeamHubClient(hubId);
      const image = await client.getUserAvatar(userId, version);
      return {
        mime: image.mime,
        bytes: image.bytes,
        dataUrl: image.dataUrl
      };
    }
  );
}
