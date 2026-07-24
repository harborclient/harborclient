/**
 * Local RSA identity used to sign and decrypt share tokens.
 */
export interface SharingIdentity {
  /**
   * PEM-encoded RSA public key.
   */
  publicKeyPem: string;

  /**
   * SHA-256 fingerprint of the public key (hex).
   */
  fingerprint: string;
}

/**
 * A trusted collaborator public key used to verify share token signatures.
 */
export interface TrustedSharingKey {
  /**
   * SHA-256 fingerprint of the SPKI public key (hex).
   */
  id: string;

  /**
   * User-defined label for the key owner.
   */
  label: string;

  /**
   * PEM-encoded RSA public key.
   */
  publicKeyPem: string;

  /**
   * Unix timestamp when the key was added.
   */
  addedAt: number;
}

/**
 * Result of exporting a PEM key to disk via a native save dialog.
 */
export interface PemExportResult {
  /**
   * True when the user canceled the save dialog.
   */
  canceled: boolean;

  /**
   * Absolute path written when not canceled.
   */
  path?: string;
}

/**
 * Result of saving arbitrary text to disk via a native save dialog.
 */
export interface SaveTextFileResult {
  /**
   * True when the user canceled the save dialog.
   */
  canceled: boolean;

  /**
   * Absolute path written when not canceled.
   */
  path?: string;
}

/**
 * Result of a HarborClient backup export save-dialog action.
 */
export interface BackupExportResult {
  /**
   * True when the user canceled the save dialog.
   */
  canceled: boolean;

  /**
   * Absolute path where the `.hcb` file was written; omitted when canceled.
   */
  path?: string;
}

/**
 * Result of a HarborClient backup restore open-dialog action.
 */
export interface BackupImportResult {
  /**
   * True when the user canceled the open dialog.
   */
  canceled: boolean;

  /**
   * Renderer localStorage entries restored from the backup; omitted when canceled.
   */
  localStorage?: Record<string, string>;
}
