import { app, BrowserWindow, dialog } from 'electron';
import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  ensureSharingKeys,
  getSharingIdentity,
  importSharingKeyPair
} from '#/main/sharing/sharingKeys';
import { createShareToken, verifyShareToken } from '#/main/sharing/shareToken';
import { addTrustedKey, listTrustedKeys, removeTrustedKey } from '#/main/sharing/trustedKeys';
import {
  findMatchingConnection,
  listStorageConnections,
  saveStorageConnection
} from '#/main/settings/storageSettings';
import { getSlotForConnection } from '#/main/settings/storageSlots';
import type { StorageConnection } from '#/shared/types';

/**
 * Registers IPC handlers for collection sharing and trusted key management.
 *
 * @param db - Database instance used for share token creation and shared collection registration.
 */
export function registerSharingHandlers(db: IStorage): void {
  // Creates an encrypted share token for sharing a collection.
  handle('share:create', ipcArgSchemas.shareCreate, async (_event, collectionId, recipientKid) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Sharing is unavailable.');
    }

    if (!recipientKid) {
      throw new Error(
        'A recipient key is required. Add their public key under Sharing Keys and select them when creating a share token.'
      );
    }

    const share = db.getShareInfo(collectionId);
    const connection = listStorageConnections().find((conn) => conn.id === share.connectionId);
    if (!connection) {
      throw new Error(`Unknown database connection: ${share.connectionId}`);
    }
    if (connection.type === 'sqlite') {
      throw new Error('SQLite connections cannot be shared via share token.');
    }

    const recipient = listTrustedKeys().find((key) => key.id === recipientKid);
    if (!recipient) {
      throw new Error(`Unknown recipient key: ${recipientKid}`);
    }

    const { privateKey, publicKey } = await ensureSharingKeys(app.getPath('userData'));
    return createShareToken(
      connection,
      { name: share.name, providerCollectionId: share.providerCollectionId },
      privateKey,
      publicKey,
      recipient.publicKeyPem
    );
  });

  // Verifies a share token and registers the shared collection connection.
  handle('share:join', ipcArgSchemas.token, async (_event, shareToken) => {
    const { privateKey, publicKey } = await ensureSharingKeys(app.getPath('userData'));
    let connection;
    let collection;
    try {
      ({ connection, collection } = verifyShareToken(
        shareToken,
        privateKey,
        publicKey,
        listTrustedKeys()
      ));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Invalid share token.', {
        cause: err
      });
    }

    const existing = findMatchingConnection(connection);
    const targetConn: StorageConnection = existing ?? { ...connection, id: randomUUID() };
    if (!existing) {
      saveStorageConnection(targetConn);
    }

    const slot = getSlotForConnection(targetConn.id);
    if (slot == null) {
      throw new Error('Failed to assign a slot for the shared connection.');
    }

    if (db instanceof RoutingStorage) {
      try {
        await db.registerSharedCollection(targetConn, slot, app.getPath('userData'), collection);
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : 'Failed to connect to the shared database.'
        );
      }
    }

    return listStorageConnections();
  });

  // Returns the local sharing RSA identity (public key and fingerprint).
  handle('sharingKeys:getIdentity', ipcArgSchemas.none, async () => {
    return getSharingIdentity(app.getPath('userData'));
  });

  // Writes the local sharing private key to a PEM file via a save dialog.
  handle('sharingKeys:exportPrivateKey', ipcArgSchemas.none, async () => {
    const { privateKey } = await ensureSharingKeys(app.getPath('userData'));
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: 'sharing-key.pem',
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

  // Writes the local sharing public key to a PEM file via a save dialog.
  handle('sharingKeys:exportPublicKey', ipcArgSchemas.none, async () => {
    const { publicKey } = await ensureSharingKeys(app.getPath('userData'));
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      defaultPath: 'sharing-pub.pem',
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

  // Imports a local sharing key pair from a PEM file via an open dialog.
  handle('sharingKeys:importKeyPair', ipcArgSchemas.none, async () => {
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
    return importSharingKeyPair(app.getPath('userData'), privateKeyPem);
  });

  // Lists trusted recipient public keys for share token encryption.
  handle('sharingKeys:listTrustedKeys', ipcArgSchemas.none, () => listTrustedKeys());

  // Adds a trusted recipient public key by label and PEM content.
  handle('sharingKeys:addTrustedKey', ipcArgSchemas.labelAndPublicKey, (_event, keyLabel, keyPem) =>
    addTrustedKey(keyLabel, keyPem)
  );

  // Imports a trusted recipient public key from a PEM file via an open dialog.
  handle('sharingKeys:importTrustedPublicKey', ipcArgSchemas.label, async (_event, keyLabel) => {
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

    const importedPublicKeyPem = await readFile(filePaths[0], 'utf-8');
    return addTrustedKey(keyLabel, importedPublicKeyPem);
  });

  // Removes a trusted recipient public key by id.
  handle('sharingKeys:removeTrustedKey', ipcArgSchemas.connectionId, (_event, id) =>
    removeTrustedKey(id)
  );
}
