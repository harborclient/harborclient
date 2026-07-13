import type { BackupExportResult, BackupImportResult } from '#/shared/types/sharing';

/**
 * IPC methods for backup.
 */
export interface ApiBackup {
  /**
   * Exports all local HarborClient data to a `.hcb` backup file via a native save dialog.
   *
   * @param localStorage - Renderer localStorage snapshot to embed in the archive.
   */
  exportBackup: (localStorage: Record<string, string>) => Promise<BackupExportResult>;
  /**
   * Restores local HarborClient data from a `.hcb` backup file via a native open dialog.
   *
   * @returns Restored renderer localStorage when written; the app should restart afterward.
   */
  importBackup: () => Promise<BackupImportResult>;
  /**
   * Relaunches HarborClient so restored on-disk state is loaded cleanly.
   */
  restartApp: () => Promise<void>;
  /**
   * Returns the Electron userData directory where HarborClient stores local files.
   */
  getUserDataPath: () => Promise<string>;
}
