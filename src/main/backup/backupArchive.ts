import JSZip from 'jszip';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs';
import { dirname, join, posix } from 'path';
import { pathHasParentSegment } from '#/main/pathHasParentSegment';
import { listStorageConnections } from '#/main/settings/storageSettings';
import { normalizeSqliteFilename } from '#/main/settings/sqliteFilename';

/** Current HarborClient backup archive format version. */
export const BACKUP_FORMAT_VERSION = 1;

/** Path of the manifest inside a backup archive. */
export const MANIFEST_PATH = 'manifest.json';

/** Path of renderer localStorage snapshot inside a backup archive. */
export const LOCAL_STORAGE_PATH = 'localStorage.json';

/** Native save/open dialog filter for HarborClient backup files. */
export const BACKUP_FILE_FILTER = {
  name: 'HarborClient Backup',
  extensions: ['hcb'] as string[]
} as const;

const DEFAULT_SQLITE_FILENAME = 'harborclient.db';
const LEGACY_SQLITE_FILENAME = 'harbor-client.db';
const REGISTRY_DB_FILENAME = 'harborclient-registry.db';

const FIXED_TOP_LEVEL_FILES = [
  REGISTRY_DB_FILENAME,
  'settings.json',
  'window-state.json',
  'sharing-key.pem',
  'sharing-pub.pem',
  'local-secrets.key'
] as const;

const BACKUP_DIRECTORIES = [
  'git-index',
  'git-provider-settings',
  'plugin-databases',
  'custom_themes'
] as const;

/**
 * Metadata stored at the root of every HarborClient backup archive.
 */
export interface BackupManifest {
  /** Schema version for forward-compatible restore. */
  backupFormatVersion: number;

  /** HarborClient semver at export time. */
  appVersion: string;

  /** ISO-8601 timestamp when the backup was created. */
  exportedAt: string;

  /** Node process platform at export time. */
  platform: string;

  /** Relative paths of userData files included in the archive (excluding manifest/localStorage). */
  files: string[];
}

/**
 * Parsed backup archive ready to apply to userData.
 */
export interface ExtractedBackup {
  /** Validated manifest from the archive. */
  manifest: BackupManifest;

  /** Relative path to absolute bytes for each userData file. */
  files: Map<string, Uint8Array>;

  /** Renderer localStorage key/value pairs to restore after restart. */
  localStorage: Record<string, string>;
}

/**
 * A file under userData eligible for backup.
 */
export interface BackupFileEntry {
  /** Path relative to userData using forward slashes. */
  relativePath: string;

  /** Absolute path on disk. */
  absolutePath: string;
}

/**
 * Returns true when a relative archive path is safe to extract into userData.
 *
 * @param relativePath - Zip entry path relative to userData root.
 */
export function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith('/') || relativePath.includes('\\')) {
    return false;
  }

  const normalized = posix.normalize(relativePath.replace(/\\/g, '/'));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return false;
  }

  return !pathHasParentSegment(normalized);
}

/**
 * Adds a file entry when it exists on disk.
 *
 * @param entries - Collector array.
 * @param userDataPath - Electron userData directory.
 * @param relativePath - Path relative to userData.
 */
function addFileIfExists(
  entries: BackupFileEntry[],
  userDataPath: string,
  relativePath: string
): void {
  const absolutePath = join(userDataPath, relativePath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    return;
  }

  entries.push({
    relativePath: relativePath.replace(/\\/g, '/'),
    absolutePath
  });
}

/**
 * Adds a SQLite database file and its WAL sidecars when present.
 *
 * @param entries - Collector array.
 * @param userDataPath - Electron userData directory.
 * @param dbFilename - Base SQLite filename in userData.
 */
function addSqliteFamily(
  entries: BackupFileEntry[],
  userDataPath: string,
  dbFilename: string
): void {
  addFileIfExists(entries, userDataPath, dbFilename);
  addFileIfExists(entries, userDataPath, `${dbFilename}-wal`);
  addFileIfExists(entries, userDataPath, `${dbFilename}-shm`);
}

/**
 * Recursively collects files under a directory relative to userData.
 *
 * @param entries - Collector array.
 * @param userDataPath - Electron userData directory.
 * @param directoryName - Top-level directory name under userData.
 */
function addDirectoryIfExists(
  entries: BackupFileEntry[],
  userDataPath: string,
  directoryName: string
): void {
  const directoryPath = join(userDataPath, directoryName);
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
    return;
  }

  const walk = (currentAbs: string, currentRel: string): void => {
    for (const name of readdirSync(currentAbs)) {
      const nextAbs = join(currentAbs, name);
      const nextRel = `${currentRel}/${name}`.replace(/\\/g, '/');
      const stats = statSync(nextAbs);
      if (stats.isDirectory()) {
        walk(nextAbs, nextRel);
        continue;
      }
      if (stats.isFile()) {
        entries.push({ relativePath: nextRel, absolutePath: nextAbs });
      }
    }
  };

  walk(directoryPath, directoryName);
}

/**
 * Collects SQLite provider filenames referenced by saved database connections.
 *
 * @param sqliteFilenames - Optional filenames to use instead of reading the registry.
 * @returns Unique filenames to include in the backup allowlist.
 */
function collectSqliteProviderFilenames(sqliteFilenames?: string[]): string[] {
  if (sqliteFilenames) {
    return [...new Set([DEFAULT_SQLITE_FILENAME, LEGACY_SQLITE_FILENAME, ...sqliteFilenames])];
  }

  const filenames = new Set<string>([DEFAULT_SQLITE_FILENAME, LEGACY_SQLITE_FILENAME]);

  for (const connection of listStorageConnections()) {
    if (connection.type !== 'sqlite') continue;
    filenames.add(normalizeSqliteFilename(connection.settings.dbFilename, DEFAULT_SQLITE_FILENAME));
  }

  return [...filenames];
}

/**
 * Collects team-hub SQLite files matching `team-hub-*.db` and WAL sidecars.
 *
 * @param entries - Collector array.
 * @param userDataPath - Electron userData directory.
 */
function addTeamHubStorages(entries: BackupFileEntry[], userDataPath: string): void {
  if (!existsSync(userDataPath)) return;

  for (const name of readdirSync(userDataPath)) {
    if (!name.startsWith('team-hub-')) continue;
    if (name.endsWith('.db') || name.endsWith('.db-wal') || name.endsWith('.db-shm')) {
      addFileIfExists(entries, userDataPath, name);
    }
  }
}

/**
 * Enumerates allowlisted userData files for a HarborClient backup snapshot.
 *
 * @param userDataPath - Electron userData directory.
 * @param sqliteFilenames - Optional SQLite filenames when the registry is unavailable.
 * @returns Existing files to include in the archive.
 */
export function collectBackupFiles(
  userDataPath: string,
  sqliteFilenames?: string[]
): BackupFileEntry[] {
  const entries: BackupFileEntry[] = [];

  for (const filename of FIXED_TOP_LEVEL_FILES) {
    addFileIfExists(entries, userDataPath, filename);
  }

  addSqliteFamily(entries, userDataPath, REGISTRY_DB_FILENAME);

  for (const filename of collectSqliteProviderFilenames(sqliteFilenames)) {
    addSqliteFamily(entries, userDataPath, filename);
  }

  addTeamHubStorages(entries, userDataPath);

  for (const directoryName of BACKUP_DIRECTORIES) {
    addDirectoryIfExists(entries, userDataPath, directoryName);
  }

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.relativePath)) return false;
    seen.add(entry.relativePath);
    return true;
  });
}

/**
 * Builds a HarborClient backup archive buffer from userData and renderer localStorage.
 *
 * @param userDataPath - Electron userData directory.
 * @param localStorage - Renderer localStorage snapshot keyed by storage key.
 * @param appVersion - HarborClient semver at export time.
 * @param checkpoint - Runs WAL checkpoints on open databases before reading files.
 */
export async function buildBackupZip(
  userDataPath: string,
  localStorage: Record<string, string>,
  appVersion: string,
  checkpoint: () => void,
  sqliteFilenames?: string[]
): Promise<Buffer> {
  checkpoint();

  const files = collectBackupFiles(userDataPath, sqliteFilenames);
  const zip = new JSZip();
  const manifest: BackupManifest = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    platform: process.platform,
    files: files.map((entry) => entry.relativePath)
  };

  for (const entry of files) {
    zip.file(entry.relativePath, new Uint8Array(readFileSync(entry.absolutePath)));
  }

  zip.file(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  zip.file(LOCAL_STORAGE_PATH, JSON.stringify(localStorage, null, 2));

  return Buffer.from(
    await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
  );
}

/**
 * Parses and validates a HarborClient backup archive buffer.
 *
 * @param archiveBuffer - Raw `.hcb` file contents.
 * @returns Validated manifest, file payloads, and localStorage snapshot.
 * @throws When the archive is invalid or unsupported.
 */
export async function validateAndExtractBackup(archiveBuffer: Buffer): Promise<ExtractedBackup> {
  const zip = await JSZip.loadAsync(new Uint8Array(archiveBuffer));
  const manifestEntry = zip.file(MANIFEST_PATH);
  if (!manifestEntry) {
    throw new Error('Backup archive is missing manifest.json.');
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await manifestEntry.async('string')) as BackupManifest;
  } catch {
    throw new Error('Backup manifest is not valid JSON.');
  }

  if (manifest.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(`Unsupported backup format version: ${String(manifest.backupFormatVersion)}.`);
  }

  if (!Array.isArray(manifest.files)) {
    throw new Error('Backup manifest is missing a files list.');
  }

  const localStorageEntry = zip.file(LOCAL_STORAGE_PATH);
  let localStorage: Record<string, string> = {};
  if (localStorageEntry) {
    try {
      const parsed = JSON.parse(await localStorageEntry.async('string')) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        localStorage = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
          )
        );
      }
    } catch {
      throw new Error('Backup localStorage.json is not valid JSON.');
    }
  }

  const files = new Map<string, Uint8Array>();
  for (const relativePath of manifest.files) {
    if (typeof relativePath !== 'string' || !isSafeRelativePath(relativePath)) {
      throw new Error(`Backup contains an unsafe file path: ${String(relativePath)}`);
    }

    const entry = zip.file(relativePath);
    if (!entry || entry.dir) {
      throw new Error(`Backup archive is missing file: ${relativePath}`);
    }

    files.set(relativePath, new Uint8Array(await entry.async('arraybuffer')));
  }

  for (const name of Object.keys(zip.files)) {
    if (name === MANIFEST_PATH || name === LOCAL_STORAGE_PATH) continue;
    if (!manifest.files.includes(name)) {
      throw new Error(`Backup archive contains unexpected file: ${name}`);
    }
  }

  return { manifest, files, localStorage };
}

/**
 * Removes stale SQLite WAL sidecars for restored databases when absent from the backup.
 *
 * @param userDataPath - Electron userData directory.
 * @param restoredDbFiles - Database filenames restored from the backup manifest.
 * @param restoredPaths - Relative paths written from the backup archive.
 */
function removeStaleWalSidecars(
  userDataPath: string,
  restoredDbFiles: string[],
  restoredPaths: Set<string>
): void {
  for (const dbFilename of restoredDbFiles) {
    for (const suffix of ['-wal', '-shm'] as const) {
      const relativePath = `${dbFilename}${suffix}`;
      if (restoredPaths.has(relativePath)) continue;

      const sidecarPath = join(userDataPath, relativePath);
      if (existsSync(sidecarPath)) {
        rmSync(sidecarPath, { force: true });
      }
    }
  }
}

/**
 * Writes extracted backup files into userData, replacing existing content.
 *
 * @param userDataPath - Electron userData directory.
 * @param extracted - Parsed backup archive contents.
 */
export function applyBackup(userDataPath: string, extracted: ExtractedBackup): void {
  mkdirSync(userDataPath, { recursive: true });

  const restoredDbFiles = extracted.manifest.files.filter((path) => path.endsWith('.db'));
  const restoredPaths = new Set(extracted.files.keys());

  for (const [relativePath, contents] of extracted.files.entries()) {
    const absolutePath = join(userDataPath, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  }

  removeStaleWalSidecars(userDataPath, restoredDbFiles, restoredPaths);
}

/**
 * Builds the default filename for a new HarborClient backup export.
 *
 * @returns Suggested `.hcb` filename for the save dialog.
 */
export function defaultBackupFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `harborclient-backup-${stamp}.hcb`;
}
