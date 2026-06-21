import type { ICookieJar } from '#/main/cookieJar/ICookieJar';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for reading and writing cookies by hostname.
 *
 * @param cookieJar - Cookie jar instance shared by cookie handlers.
 */
export function registerCookieHandlers(cookieJar: ICookieJar): void {
  // Returns cookies stored for a hostname.
  handle('cookies:getForDomain', ipcArgSchemas.domain, (_event, cookieDomain) => {
    try {
      return cookieJar.getCookiesForDomain(cookieDomain);
    } catch (err) {
      console.warn(`Failed to get cookies for "${cookieDomain}":`, err);
      throw err;
    }
  });

  // Replaces cookies stored for a hostname.
  handle('cookies:setForDomain', ipcArgSchemas.setCookies, (_event, cookieDomain, cookies) => {
    try {
      cookieJar.setCookiesForDomain(cookieDomain, cookies);
    } catch (err) {
      console.warn(`Failed to set cookies for "${cookieDomain}":`, err);
      throw err;
    }
  });
}
