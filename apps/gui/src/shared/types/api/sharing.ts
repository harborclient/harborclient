import type { StorageConnection } from '#/shared/types/storage';
import type {
  PemExportResult,
  SaveTextFileResult,
  SharingIdentity,
  TrustedSharingKey
} from '#/shared/types/sharing';

/**
 * IPC methods for sharing.
 */
export interface ApiSharing {
  /**
   * Creates a signed, encrypted share token for a specific recipient.
   *
   * @param collectionId - Global collection id to share.
   * @param recipientKid - Fingerprint of the recipient's trusted public key.
   */
  createShareToken: (collectionId: number, recipientKid: string) => Promise<string>;
  /**
   * Decodes a share JWT and adds the embedded database connection.
   *
   * @param token - JWT string from a share token.
   * @returns Updated list of all connections.
   */
  joinSharedCollection: (token: string) => Promise<StorageConnection[]>;
  /**
   * Returns the local sharing identity (public key and fingerprint).
   */
  getSharingIdentity: () => Promise<SharingIdentity>;
  /**
   * Writes the local private key to a file via a native save dialog.
   */
  exportSharingPrivateKey: () => Promise<PemExportResult>;
  /**
   * Writes the local public key to a file via a native save dialog.
   */
  exportSharingPublicKey: () => Promise<PemExportResult>;
  /**
   * Replaces the local sharing key pair from a PEM private key file.
   */
  importSharingKeyPair: () => Promise<SharingIdentity>;
  /**
   * Lists trusted collaborator public keys.
   */
  listTrustedKeys: () => Promise<TrustedSharingKey[]>;
  /**
   * Adds or updates a trusted collaborator public key.
   *
   * @param label - Display label for the key owner.
   * @param publicKeyPem - PEM-encoded RSA public key.
   */
  addTrustedKey: (label: string, publicKeyPem: string) => Promise<TrustedSharingKey[]>;
  /**
   * Imports a trusted public key from a PEM file via a native open dialog.
   *
   * @param label - Display label for the key owner.
   */
  importTrustedPublicKey: (label: string) => Promise<TrustedSharingKey[]>;
  /**
   * Removes a trusted public key by fingerprint id.
   *
   * @param id - SHA-256 fingerprint of the key to remove.
   */
  removeTrustedKey: (id: string) => Promise<TrustedSharingKey[]>;
  /**
   * Writes text to a file chosen via a native save dialog.
   *
   * @param content - UTF-8 text to write.
   * @param defaultPath - Suggested filename for the save dialog.
   */
  saveTextFile: (content: string, defaultPath: string) => Promise<SaveTextFileResult>;
}
