import { CookieJar } from '#/main/cookieJar/CookieJar';
import { getLocalRegistry } from '#/main/db/localRegistryInstance';
import type { IDatabase } from '#/main/db/IDatabase';
import { registerChatHandlers } from '#/main/ipc/handlers/chats';
import { registerCollectionHandlers } from '#/main/ipc/handlers/collections';
import { registerCookieHandlers } from '#/main/ipc/handlers/cookies';
import { registerEnvironmentHandlers } from '#/main/ipc/handlers/environments';
import { registerFileHandlers } from '#/main/ipc/handlers/files';
import { registerInviteHandlers } from '#/main/ipc/handlers/invites';
import { registerLlmHandlers } from '#/main/ipc/handlers/llm';
import { registerMenuHandlers } from '#/main/ipc/handlers/menu';
import { registerNetworkHandlers } from '#/main/ipc/handlers/network';
import { registerRequestHandlers } from '#/main/ipc/handlers/requests';
import { registerSettingsHandlers } from '#/main/ipc/handlers/settings';
import { registerWindowHandlers } from '#/main/ipc/handlers/window';

/**
 * Registers IPC handlers that bridge renderer calls to db and HTTP modules.
 *
 * @param db - Database instance shared by collection, environment, and request handlers.
 */
export function registerIpcHandlers(db: IDatabase): void {
  const cookieJar = new CookieJar(getLocalRegistry());

  registerCollectionHandlers(db);
  registerChatHandlers();
  registerLlmHandlers();
  registerEnvironmentHandlers(db);
  registerRequestHandlers(db);
  registerNetworkHandlers(cookieJar);
  registerSettingsHandlers(db);
  registerMenuHandlers();
  registerCookieHandlers(cookieJar);
  registerInviteHandlers(db);
  registerFileHandlers();
  registerWindowHandlers();
}
