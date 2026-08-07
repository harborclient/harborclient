import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { createTeamHubClient } from '#/main/settings/teamHubClient';
import {
  syncTeamHubNoticeStreams,
  stopAllTeamHubNoticeStreams
} from '#/main/settings/teamHubNoticeStreamManager';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import type { ListNoticesQuery, UpdateNotificationSettingsInput } from '@harborclient/team-hub-api';

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
 * Registers IPC handlers that proxy Team Hub notice and notification routes through
 * {@link TeamHubClient}.
 */
export function registerTeamHubNoticeHandlers(): void {
  handle('teamHubs:listNotices', ipcArgSchemas.teamHubNoticeList, async (_event, hubId, query) => {
    const client = requireTeamHubClient(hubId);
    return client.listNotices(query as ListNoticesQuery | undefined);
  });

  handle('teamHubs:getNoticesUnreadCount', ipcArgSchemas.connectionId, async (_event, hubId) => {
    const client = requireTeamHubClient(hubId);
    return client.getNoticesUnreadCount();
  });

  handle(
    'teamHubs:markNoticeRead',
    ipcArgSchemas.teamHubNoticeRead,
    async (_event, hubId, noticeId) => {
      const client = requireTeamHubClient(hubId);
      return client.markNoticeRead(noticeId);
    }
  );

  handle('teamHubs:markAllNoticesRead', ipcArgSchemas.connectionId, async (_event, hubId) => {
    const client = requireTeamHubClient(hubId);
    await client.markAllNoticesRead();
  });

  handle('teamHubs:getNotificationSettings', ipcArgSchemas.connectionId, async (_event, hubId) => {
    const client = requireTeamHubClient(hubId);
    return client.getNotificationSettings();
  });

  handle(
    'teamHubs:updateNotificationSettings',
    ipcArgSchemas.teamHubNotificationSettingsUpdate,
    async (_event, hubId, input) => {
      const client = requireTeamHubClient(hubId);
      return client.updateNotificationSettings(input as UpdateNotificationSettingsInput);
    }
  );

  handle(
    'teamHubs:getDiscussionThreadSubscription',
    ipcArgSchemas.teamHubDiscussionThreadId,
    async (_event, hubId, threadId) => {
      const client = requireTeamHubClient(hubId);
      return client.getDiscussionThreadSubscription(threadId);
    }
  );

  handle(
    'teamHubs:subscribeDiscussionThread',
    ipcArgSchemas.teamHubDiscussionThreadId,
    async (_event, hubId, threadId) => {
      const client = requireTeamHubClient(hubId);
      return client.subscribeDiscussionThread(threadId);
    }
  );

  handle(
    'teamHubs:unsubscribeDiscussionThread',
    ipcArgSchemas.teamHubDiscussionThreadId,
    async (_event, hubId, threadId) => {
      const client = requireTeamHubClient(hubId);
      return client.unsubscribeDiscussionThread(threadId);
    }
  );

  handle(
    'teamHubs:syncNoticeStreams',
    ipcArgSchemas.teamHubNoticeStreamSync,
    async (_event, hubIds) => {
      syncTeamHubNoticeStreams(hubIds);
    }
  );
}

/**
 * Stops notice SSE subscriptions during application shutdown.
 */
export function shutdownTeamHubNoticeStreams(): void {
  stopAllTeamHubNoticeStreams();
}
