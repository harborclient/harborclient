import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron';
import { randomUUID } from 'crypto';
import { ensureInviteKeys, getInviteIdentity, importInviteKeyPair } from '#/main/invite/inviteKeys';
import { createInviteToken, verifyInviteToken } from '#/main/invite/inviteToken';
import { addTrustedKey, listTrustedKeys, removeTrustedKey } from '#/main/invite/trustedKeys';
import { readFile, writeFile } from 'fs/promises';
import type { IDatabase } from '#/main/db/IDatabase';
import { RoutingDatabase } from '#/main/db/RoutingDatabase';
import {
  buildCookieHeader,
  captureSetCookies,
  getCookiesForDomain,
  setCookiesForDomain
} from '#/main/cookieJar';
import { buildUrl, executeRequest } from '#/main/http';
import { runScript } from '#/main/scripts';
import {
  deleteDatabaseConnection,
  findMatchingConnection,
  getActiveDatabaseId,
  listDatabaseConnections,
  saveDatabaseConnection,
  setActiveDatabaseId
} from '#/main/settings/databaseSettings';
import { getSlotForConnection } from '#/main/settings/databaseSlots';
import { getGeneralSettings, setGeneralSettings } from '#/main/settings/generalSettings';
import {
  deleteRequestEditorTab,
  getRequestEditorTab,
  setRequestEditorTab
} from '#/main/settings/requestEditorSettings';
import type {
  DatabaseConnection,
  EditorTab,
  GeneralSettings,
  SaveRequestInput,
  ScriptRunInput,
  SendRequestInput,
  ThemeSource,
  Variable,
  KeyValue
} from '#/shared/types';

const THEME_SETTING_KEY = 'theme';

const activeRequests = new Map<string, AbortController>();

/**
 * Validates and returns a theme source value.
 *
 * @param value - Raw stored theme value.
 * @returns A valid theme source, defaulting to system.
 */
function parseThemeSource(value: string | undefined): ThemeSource {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

/**
 * Registers IPC handlers that bridge renderer calls to db and HTTP modules.
 */
export function registerIpcHandlers(db: IDatabase): void {
  ipcMain.handle('collections:list', () => db.listCollections());

  ipcMain.handle('collections:create', (_event, name: string) => db.createCollection(name));

  ipcMain.handle(
    'collections:update',
    (
      _event,
      id: number,
      name: string,
      variables: Variable[],
      headers: KeyValue[],
      preRequestScript: string,
      postRequestScript: string
    ) => db.updateCollection(id, name, variables, headers, preRequestScript, postRequestScript)
  );

  ipcMain.handle('collections:delete', (_event, id: number) => db.deleteCollection(id));

  ipcMain.handle('collections:export', async (_event, id: number) => {
    const data = await db.exportCollectionData(id);
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: `${data.name}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    };
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { canceled: false, path: filePath };
  });

  ipcMain.handle('collections:import', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const raw = await readFile(filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return db.importCollectionData(parsed);
  });

  ipcMain.handle('collections:move', (_event, id: number, targetConnectionId: string) => {
    if (!(db instanceof RoutingDatabase)) {
      throw new Error('Collection move is unavailable.');
    }
    return db.moveCollection(id, targetConnectionId);
  });

  ipcMain.handle('dialog:openFiles', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return [];
    }

    return filePaths;
  });

  ipcMain.handle('environments:list', () => db.listEnvironments());

  ipcMain.handle('environments:create', (_event, name: string) => db.createEnvironment(name));

  ipcMain.handle('environments:update', (_event, id: number, name: string, variables: Variable[]) =>
    db.updateEnvironment(id, name, variables)
  );

  ipcMain.handle('environments:delete', (_event, id: number) => db.deleteEnvironment(id));

  ipcMain.handle('requests:list', (_event, collectionId: number) => db.listRequests(collectionId));

  ipcMain.handle('requests:save', (_event, req: SaveRequestInput) => db.saveRequest(req));

  ipcMain.handle('requests:delete', (_event, id: number) => db.deleteRequest(id));

  ipcMain.handle('folders:list', (_event, collectionId: number) => db.listFolders(collectionId));

  ipcMain.handle('folders:create', (_event, collectionId: number, name: string) =>
    db.createFolder(collectionId, name)
  );

  ipcMain.handle('folders:rename', (_event, id: number, name: string) => db.renameFolder(id, name));

  ipcMain.handle('folders:delete', (_event, id: number) => db.deleteFolder(id));

  ipcMain.handle('folders:reorder', (_event, collectionId: number, orderedFolderIds: number[]) =>
    db.reorderFolders(collectionId, orderedFolderIds)
  );

  ipcMain.handle(
    'requests:reorder',
    (_event, collectionId: number, folderId: number | null, orderedRequestIds: number[]) =>
      db.reorderRequests(collectionId, folderId, orderedRequestIds)
  );

  ipcMain.handle(
    'requests:move',
    (_event, requestId: number, folderId: number | null, index: number) =>
      db.moveRequest(requestId, folderId, index)
  );

  ipcMain.handle('http:send', async (_event, req: SendRequestInput, requestId?: string) => {
    const controller = new AbortController();
    if (requestId) {
      activeRequests.set(requestId, controller);
    }

    try {
      const settings = getGeneralSettings();
      const url = buildUrl(req.url, req.params);
      const cookieHeader = buildCookieHeader(url) ?? undefined;
      const result = await executeRequest(req, settings, controller.signal, cookieHeader);
      if (result.request?.url) {
        captureSetCookies(result.request.url, result.setCookieHeaders);
      }
      return result;
    } finally {
      if (requestId) {
        activeRequests.delete(requestId);
      }
    }
  });

  ipcMain.handle('http:cancel', (_event, requestId: string) => {
    activeRequests.get(requestId)?.abort();
  });

  ipcMain.handle('scripts:run', (_event, input: ScriptRunInput) => runScript(input));

  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('theme:get', async () => parseThemeSource(await db.getSetting(THEME_SETTING_KEY)));

  ipcMain.handle('theme:set', async (_event, theme: ThemeSource) => {
    nativeTheme.themeSource = theme;
    await db.setSetting(THEME_SETTING_KEY, theme);
  });

  ipcMain.handle('general:getSettings', () => getGeneralSettings());

  ipcMain.handle('general:setSettings', (_event, settings: GeneralSettings) => {
    setGeneralSettings(settings);
  });

  ipcMain.handle('databaseConnections:list', () => listDatabaseConnections());

  ipcMain.handle('databaseConnections:save', (_event, conn: DatabaseConnection) =>
    saveDatabaseConnection(conn)
  );

  ipcMain.handle('databaseConnections:delete', (_event, id: string) =>
    deleteDatabaseConnection(id)
  );

  ipcMain.handle('database:getActiveId', () => getActiveDatabaseId());

  ipcMain.handle('database:setActiveId', (_event, id: string) => {
    setActiveDatabaseId(id);
  });

  ipcMain.handle('requestEditor:getTab', (_event, key: string) => getRequestEditorTab(key));

  ipcMain.handle('requestEditor:setTab', (_event, key: string, tab: EditorTab) => {
    setRequestEditorTab(key, tab);
  });

  ipcMain.handle('requestEditor:deleteTab', (_event, key: string) => {
    deleteRequestEditorTab(key);
  });

  ipcMain.handle('cookies:getForDomain', (_event, domain: string) => getCookiesForDomain(domain));

  ipcMain.handle('cookies:setForDomain', (_event, domain: string, cookies: KeyValue[]) => {
    setCookiesForDomain(domain, cookies);
  });

  ipcMain.handle('invite:create', async (_event, collectionId: number, recipientKid?: string) => {
    if (!(db instanceof RoutingDatabase)) {
      throw new Error('Invite is unavailable.');
    }

    if (!recipientKid) {
      throw new Error(
        'A recipient key is required. Add their public key under Certificates and select them when creating an invite.'
      );
    }

    const share = db.getShareInfo(collectionId);
    const connection = listDatabaseConnections().find((conn) => conn.id === share.connectionId);
    if (!connection) {
      throw new Error(`Unknown database connection: ${share.connectionId}`);
    }
    if (connection.type === 'sqlite') {
      throw new Error('SQLite connections cannot be shared via invite.');
    }

    const recipient = listTrustedKeys().find((key) => key.id === recipientKid);
    if (!recipient) {
      throw new Error(`Unknown recipient key: ${recipientKid}`);
    }

    const { privateKey, publicKey } = await ensureInviteKeys(app.getPath('userData'));
    return createInviteToken(
      connection,
      { name: share.name, providerCollectionId: share.providerCollectionId },
      privateKey,
      publicKey,
      recipient.publicKeyPem
    );
  });

  ipcMain.handle('invite:accept', async (_event, token: string) => {
    const { privateKey, publicKey } = await ensureInviteKeys(app.getPath('userData'));
    let connection;
    let collection;
    try {
      ({ connection, collection } = verifyInviteToken(
        token,
        privateKey,
        publicKey,
        listTrustedKeys()
      ));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Invalid invite token.', {
        cause: err
      });
    }

    const existing = findMatchingConnection(connection);
    const targetConn: DatabaseConnection = existing ?? { ...connection, id: randomUUID() };
    if (!existing) {
      saveDatabaseConnection(targetConn);
    }

    const slot = getSlotForConnection(targetConn.id);
    if (slot == null) {
      throw new Error('Failed to assign a slot for the invited connection.');
    }

    if (db instanceof RoutingDatabase) {
      try {
        await db.registerSharedCollection(targetConn, slot, app.getPath('userData'), collection);
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : 'Failed to connect to the invited database.'
        );
      }
    }

    return listDatabaseConnections();
  });

  ipcMain.handle('certs:getIdentity', async () => {
    return getInviteIdentity(app.getPath('userData'));
  });

  ipcMain.handle('certs:exportPrivateKey', async () => {
    const { privateKey } = await ensureInviteKeys(app.getPath('userData'));
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: 'invite-key.pem',
      filters: [{ name: 'PEM', extensions: ['pem'] }]
    };
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await writeFile(filePath, privateKey, 'utf-8');
    return { canceled: false, path: filePath };
  });

  ipcMain.handle('certs:exportPublicKey', async () => {
    const { publicKey } = await ensureInviteKeys(app.getPath('userData'));
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: 'invite-pub.pem',
      filters: [{ name: 'PEM', extensions: ['pem'] }]
    };
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await writeFile(filePath, publicKey, 'utf-8');
    return { canceled: false, path: filePath };
  });

  ipcMain.handle('certs:importKeyPair', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: 'PEM', extensions: ['pem'] }]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      throw new Error('Import canceled.');
    }

    const privateKeyPem = await readFile(filePaths[0], 'utf-8');
    return importInviteKeyPair(app.getPath('userData'), privateKeyPem);
  });

  ipcMain.handle('certs:listTrustedKeys', () => listTrustedKeys());

  ipcMain.handle('certs:addTrustedKey', (_event, label: string, publicKeyPem: string) =>
    addTrustedKey(label, publicKeyPem)
  );

  ipcMain.handle('certs:importTrustedPublicKey', async (_event, label: string) => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: 'PEM', extensions: ['pem'] }]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      throw new Error('Import canceled.');
    }

    const publicKeyPem = await readFile(filePaths[0], 'utf-8');
    return addTrustedKey(label, publicKeyPem);
  });

  ipcMain.handle('certs:removeTrustedKey', (_event, id: string) => removeTrustedKey(id));
}
