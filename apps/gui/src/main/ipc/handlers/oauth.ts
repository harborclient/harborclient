import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { clearOAuthToken, getValidOAuthToken } from '#/main/oauth/oauthToken';

/**
 * Registers IPC handlers for OAuth 2.0 token fetch and cache management.
 */
export function registerOAuthHandlers(): void {
  handle(
    'oauth:fetchToken',
    ipcArgSchemas.oauthFetchToken,
    async (_event, cacheKey, config, force) => {
      return getValidOAuthToken(cacheKey, config, force);
    }
  );

  handle('oauth:clearToken', ipcArgSchemas.oauthClearToken, async (_event, cacheKey) => {
    clearOAuthToken(cacheKey);
  });
}
