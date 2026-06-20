import { getCookiesForDomain, setCookiesForDomain } from '#/main/cookieJar';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for reading and writing cookies by hostname.
 */
export function registerCookieHandlers(): void {
  // Returns cookies stored for a hostname.
  handle('cookies:getForDomain', ipcArgSchemas.domain, (_event, cookieDomain) =>
    getCookiesForDomain(cookieDomain)
  );

  // Replaces cookies stored for a hostname.
  handle('cookies:setForDomain', ipcArgSchemas.setCookies, (_event, cookieDomain, cookies) => {
    setCookiesForDomain(cookieDomain, cookies);
  });
}
