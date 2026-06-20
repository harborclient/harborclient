import type { IDatabase } from '#/main/db/IDatabase';
import { registerCollectionHandlers } from '#/main/ipc/handlers/collections';
import { registerCookieHandlers } from '#/main/ipc/handlers/cookies';
import { registerEnvironmentHandlers } from '#/main/ipc/handlers/environments';
import { registerInviteHandlers } from '#/main/ipc/handlers/invites';
import { registerNetworkHandlers } from '#/main/ipc/handlers/network';
import { registerRequestHandlers } from '#/main/ipc/handlers/requests';
import { registerSettingsHandlers } from '#/main/ipc/handlers/settings';

/**
 * Registers IPC handlers that bridge renderer calls to db and HTTP modules.
 *
 * @param db - Database instance shared by collection, environment, and request handlers.
 */
export function registerIpcHandlers(db: IDatabase): void {
  registerCollectionHandlers(db);
  registerEnvironmentHandlers(db);
  registerRequestHandlers(db);
  registerNetworkHandlers();
  registerSettingsHandlers(db);
  registerCookieHandlers();
  registerInviteHandlers(db);
}
