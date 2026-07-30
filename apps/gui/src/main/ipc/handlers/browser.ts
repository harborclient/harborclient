import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { getBrowserViewManager } from '#/main/browser/BrowserViewManager';

/**
 * Registers IPC handlers for the embedded WebContentsView browser.
 */
export function registerBrowserHandlers(): void {
  handle(
    'browser:create',
    ipcArgSchemas.browserCreate,
    (_event, tabId, url, homeUrl, scripts, hcScripts) => {
      getBrowserViewManager().create(tabId, url, homeUrl, scripts, hcScripts);
    }
  );

  handle('browser:destroy', ipcArgSchemas.browserTabId, (_event, tabId) => {
    getBrowserViewManager().destroy(tabId);
  });

  handle('browser:requestClose', ipcArgSchemas.browserTabId, (_event, tabId) => {
    return getBrowserViewManager().requestClose(tabId);
  });

  handle('browser:hideAll', ipcArgSchemas.none, () => {
    getBrowserViewManager().hideAll();
  });

  handle('browser:setBounds', ipcArgSchemas.browserSetBounds, (_event, tabId, bounds) => {
    getBrowserViewManager().setBounds(tabId, bounds);
  });

  handle('browser:setVisible', ipcArgSchemas.browserSetVisible, (_event, tabId, visible) => {
    getBrowserViewManager().setVisible(tabId, visible);
  });

  handle('browser:loadURL', ipcArgSchemas.browserLoadURL, (_event, tabId, url) => {
    void getBrowserViewManager().loadURL(tabId, url);
  });

  handle('browser:goBack', ipcArgSchemas.browserTabId, (_event, tabId) => {
    void getBrowserViewManager().goBack(tabId);
  });

  handle('browser:goForward', ipcArgSchemas.browserTabId, (_event, tabId) => {
    void getBrowserViewManager().goForward(tabId);
  });

  handle('browser:reload', ipcArgSchemas.browserTabId, (_event, tabId) => {
    void getBrowserViewManager().reload(tabId);
  });

  handle('browser:goHome', ipcArgSchemas.browserTabId, (_event, tabId) => {
    void getBrowserViewManager().goHome(tabId);
  });

  handle(
    'browser:setScripts',
    ipcArgSchemas.browserSetScripts,
    (_event, tabId, scripts, hcScripts) => {
      getBrowserViewManager().setScripts(tabId, scripts, hcScripts);
    }
  );

  handle('browser:setHomeUrl', ipcArgSchemas.browserSetHomeUrl, (_event, tabId, homeUrl) => {
    getBrowserViewManager().setHomeUrl(tabId, homeUrl);
  });

  handle(
    'browser:executeJavaScript',
    ipcArgSchemas.browserExecuteJavaScript,
    (_event, tabId, code) => getBrowserViewManager().executeJavaScript(tabId, code)
  );

  handle('browser:insertCSS', ipcArgSchemas.browserInsertCSS, (_event, tabId, css) =>
    getBrowserViewManager().insertCSS(tabId, css)
  );

  handle(
    'browser:querySelector',
    ipcArgSchemas.browserQuerySelector,
    (_event, tabId, selector, all, maxElements) =>
      getBrowserViewManager().querySelector(tabId, { selector, all, maxElements })
  );

  handle('browser:waitForLoad', ipcArgSchemas.browserWaitForLoad, (_event, tabId, timeoutMs) =>
    getBrowserViewManager().waitForLoad(tabId, timeoutMs)
  );

  handle('browser:capturePage', ipcArgSchemas.browserCapturePage, (_event, tabId, options) =>
    getBrowserViewManager().capturePage(tabId, options)
  );
}
