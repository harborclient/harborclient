import { CookieJar } from '@harborclient/core/cookies/CookieJar';
import { executeHttpSend } from '@harborclient/core/network/executeHttpSend';
import { runRequest } from '@harborclient/core/requestRunner';
import type {
  Collection,
  Folder,
  SavedRequest,
  ScriptRequestContext,
  SqliteSettings
} from '@harborclient/core/types';
import { initLocalDatabase, SqliteStorage } from '@harborclient/storage-sqlite';
import { CliSettingsProvider } from './adapters/CliSettingsProvider.js';
import { NodeScriptRunner } from './adapters/NodeScriptRunner.js';
import { resolveHarborUserDataPath } from './userDataPath.js';

/**
 * Options for running a saved collection from the shared GUI database.
 */
export interface RunCollectionOptions {
  /**
   * Collection display name or uuid.
   */
  collectionRef: string;

  /**
   * Optional Electron userData override.
   */
  userDataPath?: string;

  /**
   * When true, stop after the first HTTP or test failure.
   */
  stopOnFailure?: boolean;
}

/**
 * Finds a collection by name or uuid (case-insensitive name match).
 *
 * @param collections - Loaded collections.
 * @param ref - Name or uuid.
 * @returns Matching collection, or undefined.
 */
function findCollection(collections: Collection[], ref: string): Collection | undefined {
  const trimmed = ref.trim();
  return (
    collections.find((c) => c.uuid === trimmed) ??
    collections.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
  );
}

/**
 * Builds the script request context from a saved request row.
 *
 * @param request - Persisted request.
 * @returns ScriptRequestContext for RequestRunner.
 */
function toRequestContext(request: SavedRequest): ScriptRequestContext {
  return {
    method: request.method,
    url: request.url,
    headers: request.headers.map((h) => ({ ...h })),
    params: request.params.map((p) => ({ ...p })),
    body: request.body,
    bodyType: request.body_type,
    auth: request.auth,
    tags: request.tags,
    comment: request.comment
  };
}

/**
 * Opens the GUI SQLite provider and runs every request in a named collection.
 *
 * @param options - Collection reference and run options.
 * @returns Exit code (0 success, 1 failure).
 */
export async function runCollection(options: RunCollectionOptions): Promise<number> {
  const userDataPath = resolveHarborUserDataPath(options.userDataPath);
  const database = await initLocalDatabase(userDataPath);
  const settingsProvider = new CliSettingsProvider(database);
  const settings = settingsProvider.getGeneralSettings();

  const sqliteSettings = resolveSqliteSettings(database);
  const storage = new SqliteStorage(userDataPath, sqliteSettings);
  await storage.init();

  const collections = await storage.listCollections();
  const collection = findCollection(collections, options.collectionRef);
  if (!collection) {
    console.error(`Collection not found: ${options.collectionRef}`);
    console.error(
      `Available: ${collections.map((c) => c.name).join(', ') || '(none — is userData correct?)'}`
    );
    console.error(`userData: ${userDataPath}`);
    await storage.close();
    return 1;
  }

  const requests = await storage.listRequests(collection.id);
  const folders = await storage.listFolders(collection.id);
  const folderById = new Map<number, Folder>(folders.map((f) => [f.id, f]));

  const ordered = [...requests].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );

  const cookieJar = new CookieJar(database);
  const scriptRunner = new NodeScriptRunner(settings.scriptTimeoutMs, true);
  let failures = 0;

  try {
    for (const request of ordered) {
      const folder =
        request.folder_id != null ? (folderById.get(request.folder_id) ?? undefined) : undefined;
      process.stdout.write(`${request.method} ${request.name} ... `);

      const scripts = [
        ...(request.pre_request_script.trim()
          ? [
              {
                phase: 'pre' as const,
                label: 'Pre-request',
                source: request.pre_request_script
              }
            ]
          : []),
        ...(request.post_request_script.trim()
          ? [
              {
                phase: 'post' as const,
                label: 'Post-request',
                source: request.post_request_script
              }
            ]
          : [])
      ];

      const result = await runRequest(
        {
          request: toRequestContext(request),
          requestIdentity: {
            id: request.id,
            name: request.name,
            bodyRaw: request.body_raw
          },
          collection,
          folder,
          scripts
        },
        {
          settings: settingsProvider,
          cookieJar,
          scriptRunner,
          transport: (input, signal) =>
            executeHttpSend(input, { settings: settingsProvider, cookieJar }, signal)
        }
      );

      const failed =
        Boolean(result.response?.error) ||
        (result.response != null && result.response.status >= 400) ||
        result.testResults.some((t) => !t.passed);

      if (failed) {
        failures += 1;
        const status = result.response?.status ?? '?';
        const err = result.response?.error ?? result.scriptError ?? 'failed';
        console.log(`${status} FAIL (${err})`);
        if (options.stopOnFailure) {
          break;
        }
      } else {
        console.log(`${result.response?.status ?? 'ok'} OK`);
      }
    }
  } finally {
    scriptRunner.dispose();
    await storage.close();
  }

  return failures > 0 ? 1 : 0;
}

/**
 * Resolves SQLite provider settings from the local registry, with safe defaults.
 *
 * @param database - Local registry database.
 * @returns SqliteSettings for opening the provider database.
 */
function resolveSqliteSettings(database: {
  getSetting(key: string): string | undefined;
}): SqliteSettings {
  const defaults: SqliteSettings = {
    dbFilename: 'harborclient.db',
    legacyDbFilename: 'database.db',
    legacyUserDataDir: 'HarborClient'
  };

  const connectionsJson = database.getSetting('storageConnections');
  if (!connectionsJson) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(connectionsJson) as Array<{
      type?: string;
      settings?: Partial<SqliteSettings>;
    }>;
    const sqlite = parsed.find((c) => c.type === 'sqlite');
    if (!sqlite?.settings) {
      return defaults;
    }
    return {
      dbFilename: sqlite.settings.dbFilename ?? defaults.dbFilename,
      legacyDbFilename: sqlite.settings.legacyDbFilename ?? defaults.legacyDbFilename,
      legacyUserDataDir: sqlite.settings.legacyUserDataDir ?? defaults.legacyUserDataDir
    };
  } catch {
    return defaults;
  }
}
