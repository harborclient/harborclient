import { app, BrowserWindow, dialog } from 'electron';
import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import type { IDatabase } from '#/main/db/IDatabase';
import { RoutingDatabase } from '#/main/db/RoutingDatabase';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { ensureInviteKeys, getInviteIdentity, importInviteKeyPair } from '#/main/invite/inviteKeys';
import { createInviteToken, verifyInviteToken } from '#/main/invite/inviteToken';
import { addTrustedKey, listTrustedKeys, removeTrustedKey } from '#/main/invite/trustedKeys';
import {
  findMatchingConnection,
  listDatabaseConnections,
  saveDatabaseConnection
} from '#/main/settings/databaseSettings';
import { getSlotForConnection } from '#/main/settings/databaseSlots';
import type { DatabaseConnection } from '#/shared/types';

/**
 * Registers IPC handlers for collection invites and trusted certificate management.
 *
 * @param db - Database instance used for invite creation and shared collection registration.
 */
export function registerInviteHandlers(db: IDatabase): void {
  // Creates an encrypted invite token for sharing a collection.
  handle(
    'invite:create',
    ipcArgSchemas.inviteCreate,
    async (_event, collectionId, recipientKid) => {
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
    }
  );

  // Verifies an invite token and registers the shared collection connection.
  handle('invite:accept', ipcArgSchemas.token, async (_event, inviteToken) => {
    const { privateKey, publicKey } = await ensureInviteKeys(app.getPath('userData'));
    let connection;
    let collection;
    try {
      ({ connection, collection } = verifyInviteToken(
        inviteToken,
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

  // Returns the local invite RSA identity (public key and fingerprint).
  handle('certs:getIdentity', ipcArgSchemas.none, async () => {
    return getInviteIdentity(app.getPath('userData'));
  });

  // Writes the local invite private key to a PEM file via a save dialog.
  handle('certs:exportPrivateKey', ipcArgSchemas.none, async () => {
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

  // Writes the local invite public key to a PEM file via a save dialog.
  handle('certs:exportPublicKey', ipcArgSchemas.none, async () => {
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

  // Imports a local invite key pair from a PEM file via an open dialog.
  handle('certs:importKeyPair', ipcArgSchemas.none, async () => {
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

  // Lists trusted recipient public keys for invite encryption.
  handle('certs:listTrustedKeys', ipcArgSchemas.none, () => listTrustedKeys());

  // Adds a trusted recipient public key by label and PEM content.
  handle('certs:addTrustedKey', ipcArgSchemas.labelAndPublicKey, (_event, keyLabel, keyPem) =>
    addTrustedKey(keyLabel, keyPem)
  );

  // Imports a trusted recipient public key from a PEM file via an open dialog.
  handle('certs:importTrustedPublicKey', ipcArgSchemas.label, async (_event, keyLabel) => {
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
  handle('certs:removeTrustedKey', ipcArgSchemas.connectionId, (_event, id) =>
    removeTrustedKey(id)
  );
}
