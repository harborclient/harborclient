import { access, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CookieJar } from '@harborclient/core/cookies/CookieJar';
import { executeHttpSend } from '@harborclient/core/network/executeHttpSend';
import type { RunRequestResult } from '@harborclient/core/requestRunner/types';
import type {
  Collection,
  Environment,
  Folder,
  SavedRequest,
  SqliteSettings,
  Workflow
} from '@harborclient/core/types';
import {
  buildWorkflowRunExportFileName,
  buildWorkflowRunRequestResultFromHeadlessSend,
  createHeadlessWorkflowExecutor,
  createHeadlessWorkflowSession,
  runWorkflow,
  type HeadlessWorkflowHost
} from '@harborclient/core/workflowRunner';
import { initLocalDatabase, SqliteStorage } from '@harborclient/storage-sqlite';
import { CliSettingsProvider } from './adapters/CliSettingsProvider.js';
import { NodeScriptRunner } from './adapters/NodeScriptRunner.js';
import { resolveHarborUserDataPath } from './userDataPath.js';

/**
 * Options for running a saved workflow from the shared GUI database.
 */
export interface RunWorkflowOptions {
  /**
   * Workflow display name or uuid.
   */
  workflowRef: string;

  /**
   * Optional Electron userData override.
   */
  userDataPath?: string;

  /**
   * When true, stop after the first failed request.send.
   */
  stopOnFailure?: boolean;

  /**
   * Directory to write a workflow-run JSON export into.
   */
  exportDirectory?: string;
}

/**
 * Finds a workflow by name or uuid (case-insensitive name match).
 *
 * @param workflows - Loaded workflows.
 * @param ref - Name or uuid.
 * @returns Matching workflow, or undefined.
 */
function findWorkflow(workflows: Workflow[], ref: string): Workflow | undefined {
  const trimmed = ref.trim();
  return (
    workflows.find((workflow) => workflow.uuid === trimmed) ??
    workflows.find((workflow) => workflow.name.toLowerCase() === trimmed.toLowerCase())
  );
}

/**
 * Opens the GUI SQLite provider and runs a named workflow headlessly.
 *
 * @param options - Workflow reference and run options.
 * @returns Exit code (0 success, 1 failure).
 */
export async function runWorkflowCommand(options: RunWorkflowOptions): Promise<number> {
  const userDataPath = resolveHarborUserDataPath(options.userDataPath);
  const database = await initLocalDatabase(userDataPath);
  const settingsProvider = new CliSettingsProvider(database);
  const settings = settingsProvider.getGeneralSettings();

  const workflows = database.listWorkflows();
  const workflow = findWorkflow(workflows, options.workflowRef);
  if (!workflow) {
    console.error(`Workflow not found: ${options.workflowRef}`);
    console.error(
      `Available: ${workflows.map((item) => item.name).join(', ') || '(none — is userData correct?)'}`
    );
    console.error(`userData: ${userDataPath}`);
    return 1;
  }

  const sqliteSettings = resolveSqliteSettings(database);
  const storage = new SqliteStorage(userDataPath, sqliteSettings);
  await storage.init();

  const collections = await storage.listCollections();
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));
  const environments = await storage.listEnvironments();
  const environmentByUuid = new Map(
    environments.map((environment) => [environment.uuid, environment])
  );
  const environmentById = new Map(environments.map((environment) => [environment.id, environment]));

  const requestCache = new Map<number, SavedRequest[]>();

  /**
   * Lists requests for a collection, caching the result.
   *
   * @param collectionId - Collection database id.
   * @returns Requests in that collection.
   */
  async function requestsForCollection(collectionId: number): Promise<SavedRequest[]> {
    const cached = requestCache.get(collectionId);
    if (cached != null) {
      return cached;
    }
    const listed = await storage.listRequests(collectionId);
    requestCache.set(collectionId, listed);
    return listed;
  }

  const host: HeadlessWorkflowHost = {
    /**
     * Resolves a saved request by uuid or id across loaded collections.
     *
     * @param ref - Request identity from a recorded load payload.
     * @returns Saved request, or null.
     */
    async resolveRequest(ref): Promise<SavedRequest | null> {
      for (const collection of collections) {
        const requests = await requestsForCollection(collection.id);
        if (ref.uuid) {
          const byUuid = requests.find((request) => request.uuid === ref.uuid);
          if (byUuid != null) {
            return byUuid;
          }
        }
        if (ref.id != null) {
          const byId = requests.find((request) => request.id === ref.id);
          if (byId != null) {
            return byId;
          }
        }
      }
      return null;
    },

    /**
     * Loads a collection by id from the in-memory map.
     *
     * @param collectionId - Collection id.
     * @returns Collection, or null.
     */
    async getCollection(collectionId): Promise<Collection | null> {
      return collectionById.get(collectionId) ?? null;
    },

    /**
     * Loads a folder by id within a collection.
     *
     * @param collectionId - Collection id.
     * @param folderId - Folder id.
     * @returns Folder, or null.
     */
    async getFolder(collectionId, folderId): Promise<Folder | null> {
      const folders = await storage.listFolders(collectionId);
      return folders.find((folder) => folder.id === folderId) ?? null;
    },

    /**
     * Resolves an environment by uuid.
     *
     * @param uuid - Environment uuid.
     * @returns Environment, or null.
     */
    async getEnvironmentByUuid(uuid): Promise<Environment | null> {
      return environmentByUuid.get(uuid) ?? null;
    },

    /**
     * Resolves an environment by numeric id.
     *
     * @param id - Environment database id.
     * @returns Environment, or null.
     */
    async getEnvironmentById(id): Promise<Environment | null> {
      return environmentById.get(id) ?? null;
    }
  };

  const cookieJar = new CookieJar(database);
  const scriptRunner = new NodeScriptRunner(settings.scriptTimeoutMs, true);
  const session = createHeadlessWorkflowSession();

  const executor = createHeadlessWorkflowExecutor({
    session,
    host,
    runnerDeps: {
      settings: settingsProvider,
      cookieJar,
      scriptRunner,
      transport: (input, signal) =>
        executeHttpSend(input, { settings: settingsProvider, cookieJar }, signal)
    },
    workflowUuid: workflow.uuid
  });

  console.log(`Running workflow: ${workflow.name} (${workflow.actions.length} actions)`);

  try {
    const result = await runWorkflow({
      actions: workflow.actions,
      workflowUuid: workflow.uuid,
      workflowName: workflow.name,
      environmentUuid: session.activeEnvironmentUuid ?? '',
      delayMs: workflow.delayMs,
      gapless: true,
      stopOnFailure: options.stopOnFailure,
      executor,
      resolveLogResult: (action, playResult) => {
        if (
          action.type !== 'request.send' ||
          playResult == null ||
          typeof playResult !== 'object'
        ) {
          return action.payload as unknown;
        }
        if (session.activeDraft == null) {
          return action.payload as unknown;
        }
        return buildWorkflowRunRequestResultFromHeadlessSend(
          session.activeDraft,
          playResult as RunRequestResult
        );
      },
      onStepComplete: (entry, stepIndex) => {
        const label = entry.action.type;
        if (entry.action.type === 'request.send' && session.activeDraft != null) {
          const outcome = entry.result as { response?: { status?: number; error?: string } };
          const status = outcome.response?.status ?? '?';
          process.stdout.write(
            `[${stepIndex + 1}/${workflow.actions.length}] ${session.activeDraft.method} ${session.activeDraft.name} ... ${status}\n`
          );
        } else {
          process.stdout.write(`[${stepIndex + 1}/${workflow.actions.length}] ${label}\n`);
        }
      }
    });

    if (result.error != null) {
      console.error(result.error instanceof Error ? result.error.message : String(result.error));
      return 1;
    }

    // Rebuild export with the final environment after the run (activate may change it).
    const exportPayload = {
      ...result.export,
      environment: session.activeEnvironmentUuid ?? result.export.environment
    };

    if (options.exportDirectory) {
      try {
        const written = await writeWorkflowRunExport(options.exportDirectory, exportPayload);
        console.log(`Exported results: ${written}`);
      } catch (error) {
        console.error(
          `Failed to export results: ${error instanceof Error ? error.message : String(error)}`
        );
        return 1;
      }
    }

    if (result.failures > 0 || result.stoppedOnFailure) {
      console.error(`Workflow finished with ${result.failures} failure(s)`);
      return 1;
    }

    console.log('Workflow completed successfully');
    return 0;
  } finally {
    scriptRunner.dispose();
    await storage.close();
  }
}

/**
 * Writes a workflow-run export JSON file under a directory with collision suffixes.
 *
 * @param directory - Destination directory.
 * @param payload - Export envelope to serialize.
 * @returns Absolute path written.
 */
async function writeWorkflowRunExport(directory: string, payload: unknown): Promise<string> {
  const directoryResolved = resolve(directory.trim());
  await mkdir(directoryResolved, { recursive: true });
  const preferredName = buildWorkflowRunExportFileName();
  const filePath = await resolveAvailablePath(directoryResolved, preferredName);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

/**
 * Picks an unused absolute path under a directory for the preferred basename.
 *
 * @param directory - Absolute destination directory.
 * @param fileName - Preferred basename.
 * @returns Absolute path that does not currently exist.
 */
async function resolveAvailablePath(directory: string, fileName: string): Promise<string> {
  const preferred = join(directory, fileName);
  try {
    await access(preferred);
  } catch {
    return preferred;
  }

  const extensionIndex = fileName.lastIndexOf('.');
  const stem = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  const extension = extensionIndex > 0 ? fileName.slice(extensionIndex) : '';
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = join(directory, `${stem}-${suffix}${extension}`);
    try {
      await access(candidate);
    } catch {
      return candidate;
    }
  }
  throw new Error('Could not find an available filename in the destination directory');
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
    const sqlite = parsed.find((connection) => connection.type === 'sqlite');
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
