import { CookieJar } from '#/main/cookieJar/CookieJar';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import type { IStorage } from '#/main/storage/IStorage';
import { registerChatHandlers } from '#/main/ipc/handlers/chats';
import { registerCollectionHandlers } from '#/main/ipc/handlers/collections';
import { registerCookieHandlers } from '#/main/ipc/handlers/cookies';
import { registerEnvironmentHandlers } from '#/main/ipc/handlers/environments';
import { registerFileHandlers } from '#/main/ipc/handlers/files';
import { registerGitHandlers } from '#/main/ipc/handlers/git';
import { registerSharingHandlers } from '#/main/ipc/handlers/sharing';
import { registerLlmHandlers } from '#/main/ipc/handlers/llm';
import { registerMenuHandlers } from '#/main/ipc/handlers/menu';
import { registerNetworkHandlers } from '#/main/ipc/handlers/network';
import { registerRequestHandlers } from '#/main/ipc/handlers/requests';
import { registerSettingsHandlers } from '#/main/ipc/handlers/settings';
import { registerBackupHandlers } from '#/main/ipc/handlers/backup';
import { registerWindowHandlers } from '#/main/ipc/handlers/window';

/**
 * Registers IPC handlers that bridge renderer calls to db and HTTP modules.
 *
 * @param db - Database instance shared by collection, environment, and request handlers.
 */
export function registerIpcHandlers(db: IStorage): void {
  const cookieJar = new CookieJar(getLocalDatabase());

  registerCollectionHandlers(db);
  registerChatHandlers();
  registerLlmHandlers();
  registerEnvironmentHandlers(db);
  registerRequestHandlers(db);
  registerNetworkHandlers(cookieJar);
  registerSettingsHandlers(db);
  registerGitHandlers(db);
  registerMenuHandlers();
  registerCookieHandlers(cookieJar);
  registerSharingHandlers(db);
  registerFileHandlers();
  registerBackupHandlers(db);
  registerWindowHandlers();
}
