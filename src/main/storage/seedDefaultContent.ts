import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { logVerbose } from '#/main/logger';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import type { RoutingStorage } from '#/main/storage/RoutingStorage';
import { validateCollectionExport } from '#/main/storage/collectionData';
import type { CollectionExport } from '#/shared/types';
import type { BuiltinCollectionOpenRequestTarget } from '#/shared/types/app';

/**
 * Local registry key marking that built-in collections have been seeded or skipped.
 */
export const BUILTIN_COLLECTIONS_SEEDED_KEY = 'builtinCollectionsSeeded';

/**
 * Local registry key for a one-shot open-request target after first-run built-in import.
 */
export const BUILTIN_COLLECTIONS_OPEN_REQUEST_KEY = 'builtinCollectionsOpenRequest';

/**
 * Local registry key marking that the Getting Started tab has been shown once.
 */
export const GETTING_STARTED_SEEN_KEY = 'gettingStartedSeen';

/** Stable UUID for the HarborClient Echo built-in collection export. */
export const BUILTIN_ECHO_COLLECTION_UUID = 'a0000000-0000-4000-8000-000000000001';

/**
 * Returns candidate directories for packaged built-in collection resources.
 *
 * @returns Ordered search paths for canonical built-in collection JSON files.
 */
export function getBuiltinCollectionsResourceDirectories(): string[] {
  const directories = new Set<string>();

  if (app.isPackaged) {
    directories.add(join(process.resourcesPath, 'builtin_collections'));
  }

  directories.add(join(app.getAppPath(), 'resources/builtin_collections'));
  directories.add(join(__dirname, '../../resources/builtin_collections'));

  return [...directories];
}

/**
 * Resolves the first existing built-in collections resource directory.
 *
 * @returns Absolute path when a directory exists, otherwise null.
 */
export function resolveBuiltinCollectionsResourceDirectory(): string | null {
  const candidates = getBuiltinCollectionsResourceDirectories();
  logVerbose('builtin-collections: candidate resource directories', candidates);

  for (const directory of candidates) {
    if (existsSync(directory)) {
      logVerbose('builtin-collections: using resource directory', directory);
      return directory;
    }
  }

  logVerbose('builtin-collections: no resource directory found');
  return null;
}

/**
 * Loads and validates every collection export JSON file in one directory.
 *
 * Invalid files are skipped with a warning so one bad export does not block startup.
 *
 * @param directory - Directory containing built-in collection export files.
 * @returns Validated collection exports sorted by filename.
 */
export function loadBuiltinCollectionExportsFromDirectory(directory: string): CollectionExport[] {
  if (!existsSync(directory)) {
    return [];
  }

  const exports: CollectionExport[] = [];
  const fileNames = readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort();

  for (const fileName of fileNames) {
    const filePath = join(directory, fileName);
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
      exports.push(validateCollectionExport(parsed));
    } catch (err) {
      console.warn(`Skipping invalid built-in collection export ${filePath}:`, err);
      logVerbose('builtin-collections: skipped invalid export', filePath, err);
    }
  }

  logVerbose('builtin-collections: loaded exports from directory', {
    directory,
    fileNames,
    exportCount: exports.length,
    collectionNames: exports.map((entry) => entry.name)
  });

  return exports;
}

/**
 * Loads built-in collection exports from the first available resource directory.
 *
 * @returns Validated collection exports, or an empty array when no directory exists.
 */
export function loadBuiltinCollectionExports(): CollectionExport[] {
  const directory = resolveBuiltinCollectionsResourceDirectory();
  if (directory == null) {
    return [];
  }

  return loadBuiltinCollectionExportsFromDirectory(directory);
}

/**
 * Imports a list of collection exports into routing storage.
 *
 * @param router - Routing storage used to import each export.
 * @param exports - Validated collection exports to import.
 * @returns Number of collections imported.
 */
export async function importBuiltinCollectionExports(
  router: RoutingStorage,
  exports: CollectionExport[]
): Promise<number> {
  let imported = 0;

  for (const exportData of exports) {
    await router.importCollectionData(exportData);
    imported++;
  }

  return imported;
}

/**
 * Parses a persisted built-in open-request target from local registry storage.
 *
 * @param raw - Serialized JSON from {@link BUILTIN_COLLECTIONS_OPEN_REQUEST_KEY}.
 * @returns Parsed target or null when missing or invalid.
 */
export function parseBuiltinCollectionOpenRequestTarget(
  raw: string | undefined
): BuiltinCollectionOpenRequestTarget | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const { collectionUuid, requestUuid } = parsed as Record<string, unknown>;
    if (typeof collectionUuid !== 'string' || typeof requestUuid !== 'string') {
      return null;
    }

    const trimmedCollectionUuid = collectionUuid.trim();
    const trimmedRequestUuid = requestUuid.trim();
    if (!trimmedCollectionUuid || !trimmedRequestUuid) {
      return null;
    }

    return {
      collectionUuid: trimmedCollectionUuid,
      requestUuid: trimmedRequestUuid
    };
  } catch {
    return null;
  }
}

/**
 * Resolves the first request to open after importing built-in collections on first launch.
 *
 * Uses the first export file after filename sort and the lowest `sort_order` request within it.
 *
 * @param exports - Validated built-in collection exports in import order.
 * @returns Stable collection/request uuids, or null when no suitable target exists.
 */
export function resolveFirstBuiltinOpenRequestTarget(
  exports: CollectionExport[]
): BuiltinCollectionOpenRequestTarget | null {
  const firstCollection = exports[0];
  if (!firstCollection?.uuid?.trim() || firstCollection.requests.length === 0) {
    return null;
  }

  const sortedRequests = firstCollection.requests
    .map((request, index) => ({ request, index }))
    .sort((left, right) => {
      const orderDelta =
        (left.request.sort_order ?? left.index) - (right.request.sort_order ?? right.index);
      return orderDelta !== 0 ? orderDelta : left.index - right.index;
    });

  for (const { request } of sortedRequests) {
    if (request.uuid?.trim()) {
      return {
        collectionUuid: firstCollection.uuid.trim(),
        requestUuid: request.uuid.trim()
      };
    }
  }

  return null;
}

/**
 * Seeds built-in collections on first launch when the one-time seed flag is unset.
 *
 * Imports any missing built-in collections by stable UUID even when the registry
 * already contains user or migrated collections. Sets the open-request target only
 * when at least one built-in collection is imported during this call.
 *
 * @param router - Routing storage used to import collections.
 * @param database - Local registry holding the one-time seed flag.
 */
export async function seedDefaultContentIfNeeded(
  router: RoutingStorage,
  database: LocalDatabase
): Promise<void> {
  const alreadySeeded = database.getSetting(BUILTIN_COLLECTIONS_SEEDED_KEY) === '1';
  logVerbose('builtin-collections: seedDefaultContentIfNeeded start', {
    alreadySeeded
  });

  if (alreadySeeded) {
    logVerbose('builtin-collections: skipping seed (already seeded flag set)');
    return;
  }

  const exports = loadBuiltinCollectionExports();
  let importedCount = 0;

  for (const exportData of exports) {
    if (!exportData.uuid?.trim()) {
      continue;
    }

    const existing = await router.findCollectionByUuid(exportData.uuid);
    if (existing) {
      continue;
    }

    await router.importCollectionData(exportData);
    importedCount++;
  }

  const openTarget = importedCount > 0 ? resolveFirstBuiltinOpenRequestTarget(exports) : null;
  if (openTarget != null) {
    database.setSetting(BUILTIN_COLLECTIONS_OPEN_REQUEST_KEY, JSON.stringify(openTarget));
    database.setSetting(GETTING_STARTED_SEEN_KEY, '1');
  }
  database.setSetting(BUILTIN_COLLECTIONS_SEEDED_KEY, '1');

  const collectionsAfterSeed = await router.listCollections();
  logVerbose('builtin-collections: seed complete', {
    exportCount: exports.length,
    importedCount,
    openTarget,
    gettingStartedSeen: database.getSetting(GETTING_STARTED_SEEN_KEY),
    collectionsAfterSeed: collectionsAfterSeed.map((entry) => ({
      id: entry.id,
      name: entry.name,
      uuid: entry.uuid
    }))
  });
}

/**
 * Reads `process.argv` for `--seed` so the flag works in both dev and packaged builds.
 *
 * @param argv - Process argv including Electron flags.
 * @returns True when explicit built-in collection seeding was requested on the command line.
 */
export function isSeedFlagEnabled(argv: string[] = process.argv): boolean {
  return argv.includes('--seed');
}

/**
 * Imports built-in collections whose stable UUIDs are not already registered.
 *
 * @param router - Initialized routing storage with a mounted default data backend.
 * @returns Number of collections imported during this call.
 */
export async function seedBuiltinCollectionsIfMissing(router: RoutingStorage): Promise<number> {
  const exports = loadBuiltinCollectionExports();
  let imported = 0;

  for (const exportData of exports) {
    if (!exportData.uuid) {
      continue;
    }

    const existing = await router.findCollectionByUuid(exportData.uuid);
    if (existing) {
      continue;
    }

    await router.importCollectionData(exportData);
    imported++;
  }

  return imported;
}
