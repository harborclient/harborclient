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
import { registerSnippetHandlers } from '#/main/ipc/handlers/snippets';
import { registerLlmHandlers } from '#/main/ipc/handlers/llm';
import { registerMenuHandlers } from '#/main/ipc/handlers/menu';
import { registerNetworkHandlers } from '#/main/ipc/handlers/network';
import { registerOAuthHandlers } from '#/main/ipc/handlers/oauth';
import { registerRunResultHandlers } from '#/main/ipc/handlers/runResults';
import { registerRequestHandlers } from '#/main/ipc/handlers/requests';
import { registerSettingsHandlers } from '#/main/ipc/handlers/settings';
import { registerBackupHandlers } from '#/main/ipc/handlers/backup';
import { registerWindowHandlers } from '#/main/ipc/handlers/window';
import { registerPluginHandlers } from '#/main/ipc/handlers/plugins';
import { registerCustomThemeHandlers } from '#/main/ipc/handlers/customThemes';
import { registerDocsHandlers } from '#/main/ipc/handlers/docs';
import { registerMcpHandlers } from '#/main/ipc/handlers/mcp';
import type { PluginManager } from '#/main/plugins/PluginManager';

/**
 * Registers IPC handlers that bridge renderer calls to db and HTTP modules.
 *
 * @param db - Database instance shared by collection, environment, and request handlers.
 * @param pluginManager - Plugin manager for install, discovery, and storage.
 */
export function registerIpcHandlers(db: IStorage, pluginManager: PluginManager): void {
  const cookieJar = new CookieJar(getLocalDatabase());

  registerCollectionHandlers(db);
  registerChatHandlers();
  registerLlmHandlers();
  registerEnvironmentHandlers(db);
  registerSnippetHandlers(db);
  registerRunResultHandlers(db);
  registerRequestHandlers(db);
  registerNetworkHandlers(cookieJar);
  registerOAuthHandlers();
  registerSettingsHandlers(db);
  registerGitHandlers(db);
  registerMenuHandlers();
  registerCookieHandlers(cookieJar);
  registerSharingHandlers(db);
  registerFileHandlers();
  registerBackupHandlers(db);
  registerWindowHandlers();
  registerPluginHandlers(pluginManager);
  registerDocsHandlers();
  registerMcpHandlers();
  registerCustomThemeHandlers();
}
