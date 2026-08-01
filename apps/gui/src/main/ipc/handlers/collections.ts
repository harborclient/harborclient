import { BrowserWindow, dialog } from 'electron';
import { writeFile } from 'fs/promises';
import { basename } from 'path';
import {
  collectionExportContainsScripts,
  requestExportContainsScripts,
  validateCollectionExport,
  validateEnvironmentExport,
  validateRequestExport,
  validateRunResultsExport
} from '#/main/storage/collectionData';
import { convertPostmanCollection, isPostmanCollection } from '#/main/import/postman';
import { convertBrunoCollection, isBrunoCollectionManifest } from '#/main/import/bruno';
import { convertHarToCollection, isHarArchive } from '#/main/import/har';
import {
  canImportOpenCollection,
  convertOpenCollection,
  isOpenCollection,
  parseOpenCollectionDocument
} from '#/main/import/opencollection';
import {
  fetchApisIoCollectionDocument,
  previewApisIoCollection,
  searchApisIoCollections
} from '#/main/import/apisIo';
import { fetchCollectionFromUrl } from '#/main/import/fetchCollectionUrl';
import { defaultAuth } from '@harborclient/core/auth';
import { mirrorLegacyScriptString, resolveScriptRefs } from '@harborclient/core/scriptRefs';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { mintFreshCollectionExportUuids, mintFreshRequestExportUuid } from '#/main/storage/uuid';
import { handle } from '#/main/ipc/handle';
import {
  confirmCollectionScripts,
  confirmDuplicateImport,
  confirmPostmanImport,
  confirmRequestScripts,
  openImportFile
} from './importDialogs';
import { importEnvironmentData } from './environments';
import { importWorkspaceData } from './workspaces';
import { importCustomThemeData } from './customThemeImport';
import { importSnippetData } from './snippetImport';
import { importLiveServerData } from './liveServerImport';
import { importWebsiteData } from './websiteImport';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { getTrashService } from '#/main/storage/trashServiceInstance';
import { logImportVerbose } from '#/main/import/importVerboseLog';
import { readHarborclientExport } from '@harborclient/core/harborclientExport';
import { canImportOpenApiSpec } from '@harborclient/core/openapi';
import type {
  Collection,
  CollectionExport,
  ImportAction,
  ImportEntityResult,
  RequestExport
} from '@harborclient/core/types';

/**
 * Result of importing a collection from a portable export file.
 */
export interface CollectionImportResult {
  /**
   * Imported or updated collection.
   */
  collection: Collection;

  /**
   * Whether a new collection was created or an existing one was updated.
   */
  action: ImportAction;
}

/**
 * Result of importing a single request from a portable export file.
 */
export interface RequestImportResult {
  /**
   * Imported or updated request with global ids.
   */
  request: Awaited<ReturnType<IStorage['saveRequest']>>;

  /**
   * Whether a new request was created or an existing one was updated.
   */
  action: ImportAction;
}

/**
 * Resolves script list fields from a portable request export for persistence.
 *
 * @param exportData - Validated request export payload.
 * @returns Legacy mirror strings and canonical script reference arrays.
 */
function requestScriptFieldsFromExport(exportData: RequestExport): {
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ReturnType<typeof resolveScriptRefs>;
  post_request_scripts: ReturnType<typeof resolveScriptRefs>;
} {
  const preRequestScripts = resolveScriptRefs(
    exportData.pre_request_scripts,
    exportData.pre_request_script
  );
  const postRequestScripts = resolveScriptRefs(
    exportData.post_request_scripts,
    exportData.post_request_script
  );
  return {
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: preRequestScripts,
    post_request_scripts: postRequestScripts
  };
}

/**
 * Looks up an existing collection by portable uuid when supported by the database layer.
 *
 * @param db - Database instance backing collection persistence.
 * @param uuid - Stable collection identifier from an export file.
 * @returns Matching collection, or null when not found or uuid is absent.
 */
async function findExistingCollection(
  db: IStorage,
  uuid: string | undefined
): Promise<Collection | null> {
  const trimmed = uuid?.trim();
  if (!trimmed) {
    return null;
  }
  return db.findCollectionByUuid(trimmed);
}

/**
 * Optional context for collection imports that require filesystem paths.
 */
interface CollectionImportContext {
  /**
   * Absolute path to a Bruno collection root directory.
   */
  collectionDir?: string;

  /**
   * Base name of the selected import file, without extension.
   */
  fileName?: string;
}

/**
 * Converts a parsed collection document into a validated HarborClient export.
 *
 * Does not show confirmation dialogs. Bruno manifests require a local directory
 * and are rejected for URL-based imports.
 *
 * @param parsed - Parsed JSON/YAML document.
 * @param context - Optional naming context (for example HAR file name).
 * @returns Validated collection export payload.
 * @throws When the format is unsupported or Bruno (directory-backed).
 */
function convertParsedToCollectionExport(
  parsed: unknown,
  context?: CollectionImportContext
): CollectionExport {
  if (isPostmanCollection(parsed)) {
    return validateCollectionExport(convertPostmanCollection(parsed));
  }
  if (isBrunoCollectionManifest(parsed)) {
    throw new Error(
      'Bruno collections cannot be imported from a URL. Choose a HarborClient, Postman, OpenCollection, or HAR file instead.'
    );
  }
  if (isHarArchive(parsed)) {
    return validateCollectionExport(convertHarToCollection(parsed, { name: context?.fileName }));
  }
  if (isOpenCollection(parsed)) {
    return validateCollectionExport(convertOpenCollection(parsed));
  }
  return validateCollectionExport(parsed);
}

/**
 * Imports a validated collection export after optional Postman/script warnings.
 *
 * @param db - Database instance backing collection persistence.
 * @param win - Focused browser window for modal dialogs, if any.
 * @param parsed - Parsed JSON payload from an import file.
 * @param context - Optional import context such as a Bruno collection directory.
 * @returns Imported collection with action, or null when the user canceled.
 */
async function importCollectionFromParsed(
  db: IStorage,
  win: BrowserWindow | null,
  parsed: unknown,
  context?: CollectionImportContext
): Promise<CollectionImportResult | null> {
  let exportData: CollectionExport;
  let skipScriptWarning = false;

  if (isPostmanCollection(parsed)) {
    if (!(await confirmPostmanImport(win))) {
      return null;
    }
    exportData = validateCollectionExport(convertPostmanCollection(parsed));
    skipScriptWarning = true;
  } else if (isBrunoCollectionManifest(parsed)) {
    const collectionDir = context?.collectionDir?.trim();
    if (!collectionDir) {
      throw new Error('Bruno collection import requires a collection directory path.');
    }
    exportData = validateCollectionExport(convertBrunoCollection(collectionDir, parsed));
  } else if (isHarArchive(parsed)) {
    exportData = validateCollectionExport(
      convertHarToCollection(parsed, { name: context?.fileName })
    );
  } else if (isOpenCollection(parsed)) {
    exportData = validateCollectionExport(convertOpenCollection(parsed));
  } else {
    exportData = validateCollectionExport(parsed);
  }

  if (
    !skipScriptWarning &&
    collectionExportContainsScripts(exportData) &&
    !(await confirmCollectionScripts(win))
  ) {
    return null;
  }

  const existing = await findExistingCollection(db, exportData.uuid);
  if (existing) {
    const choice = await confirmDuplicateImport(win, 'collection', existing.name);
    if (choice === 'cancel') {
      return null;
    }
    if (choice === 'update') {
      if (!(db instanceof RoutingStorage)) {
        throw new Error('Collection update on import is unavailable.');
      }
      const collection = await db.updateCollectionFromImport(existing.id, exportData);
      return { collection, action: 'updated' };
    }
    exportData = mintFreshCollectionExportUuids(exportData);
  }

  const collection = await db.importCollectionData(exportData);
  return { collection, action: 'created' };
}

/**
 * Saves a validated request export after optional script warnings and uuid deduplication.
 *
 * @param db - Database instance backing request persistence.
 * @param win - Focused browser window for modal dialogs, if any.
 * @param exportData - Validated request export payload.
 * @param collectionId - Collection to add the imported request to.
 * @param folderId - Target folder id, or null for collection root.
 * @returns Imported request with action, or null when the user canceled a warning.
 */
async function saveImportedRequest(
  db: IStorage,
  win: BrowserWindow | null,
  exportData: RequestExport,
  collectionId: number,
  folderId: number | null
): Promise<RequestImportResult | null> {
  if (requestExportContainsScripts(exportData) && !(await confirmRequestScripts(win))) {
    return null;
  }

  let payload = exportData;

  const requestUuid = exportData.uuid?.trim();
  if (requestUuid) {
    const existing = await db.findRequestByUuid(collectionId, requestUuid);
    if (existing) {
      const choice = await confirmDuplicateImport(win, 'request', existing.name);
      if (choice === 'cancel') {
        return null;
      }
      if (choice === 'update') {
        const scripts = requestScriptFieldsFromExport(exportData);
        const request = await db.saveRequest({
          id: existing.id,
          uuid: existing.uuid,
          collection_id: collectionId,
          folder_id: folderId,
          name: exportData.name,
          method: exportData.method,
          url: exportData.url,
          headers: exportData.headers,
          params: exportData.params,
          body: exportData.body,
          body_type: exportData.body_type,
          body_raw: exportData.body_raw ?? null,
          body_raw_open: exportData.body_raw_open === true,
          ...scripts,
          comment: exportData.comment,
          tags: exportData.tags,
          auth: exportData.auth ?? defaultAuth()
        });
        return { request, action: 'updated' };
      }
      payload = mintFreshRequestExportUuid(exportData);
    }
  }

  const scripts = requestScriptFieldsFromExport(payload);
  const request = await db.saveRequest({
    uuid: payload.uuid,
    collection_id: collectionId,
    folder_id: folderId,
    name: payload.name,
    method: payload.method,
    url: payload.url,
    headers: payload.headers,
    params: payload.params,
    body: payload.body,
    body_type: payload.body_type,
    body_raw: payload.body_raw ?? null,
    body_raw_open: payload.body_raw_open === true,
    ...scripts,
    comment: payload.comment,
    tags: payload.tags,
    auth: payload.auth ?? defaultAuth()
  });

  return { request, action: 'created' };
}

/**
 * Registers IPC handlers for collection CRUD, import/export, move, and file dialogs.
 *
 * @param db - Database instance backing collection persistence.
 */
export function registerCollectionHandlers(db: IStorage): void {
  // Lists all saved request collections.
  handle('collections:list', ipcArgSchemas.none, async () => {
    const collections = await db.listCollections();
    const warnings = db instanceof RoutingStorage ? db.consumeCollectionListWarnings() : [];
    return { collections, warnings };
  });

  // Creates a new collection with the given display name.
  handle(
    'collections:create',
    ipcArgSchemas.collectionCreate,
    (_event, collectionName, connectionId) => {
      if (connectionId && db instanceof RoutingStorage) {
        return db.createCollectionInProvider(collectionName, connectionId);
      }
      return db.createCollection(collectionName);
    }
  );

  // Updates a collection's name, variables, headers, and scripts.
  handle(
    'collections:update',
    ipcArgSchemas.collectionUpdate,
    (
      _event,
      id,
      collectionName,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      auth,
      userAgent,
      preRequestScripts,
      postRequestScripts
    ) =>
      db.updateCollection(
        id,
        collectionName,
        variables,
        headers,
        preRequestScript,
        postRequestScript,
        auth,
        userAgent,
        preRequestScripts,
        postRequestScripts
      )
  );

  handle('collections:setMarker', ipcArgSchemas.collectionsSetMarker, (_event, id, marker) =>
    db.setCollectionMarker(id, marker)
  );

  handle(
    'collections:setArchived',
    ipcArgSchemas.collectionsSetArchived,
    (_event, id, archived) => {
      getLocalDatabase().setRegistryArchived(id, archived);
    }
  );

  // Deletes a collection and all of its folders and requests.
  handle('collections:delete', ipcArgSchemas.dbId, (_event, id) =>
    getTrashService().moveCollectionToTrash(id)
  );

  // Deep-copies a collection into a new collection on the same backend.
  handle('collections:duplicate', ipcArgSchemas.dbId, (_event, id) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Collection duplicate is unavailable.');
    }
    return db.duplicateCollection(id);
  });

  // Exports a collection to a JSON file via a native save dialog.
  handle('collections:export', ipcArgSchemas.dbId, async (_event, id) => {
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

  // Exports run results to a JSON file via a native save dialog.
  handle('runResults:export', ipcArgSchemas.runResultsExport, async (_event, data) => {
    const win = BrowserWindow.getFocusedWindow();
    const defaultName = data.request?.name ?? data.collection?.name ?? 'run-results';
    const dialogOptions = {
      defaultPath: `${defaultName}.json`,
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

  // Imports run results from a JSON file selected via a native open dialog.
  handle('runResults:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const file = await openImportFile(win);
    if (!file) {
      return null;
    }

    return validateRunResultsExport(file.parsed);
  });

  // Imports a collection from a JSON file selected via a native open dialog.
  handle('collections:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const file = await openImportFile(win);
    if (!file) {
      return null;
    }

    let parsed = file.parsed;
    if (parsed == null && canImportOpenCollection(file.raw)) {
      parsed = parseOpenCollectionDocument(file.raw);
    }

    const result = await importCollectionFromParsed(db, win, parsed, {
      collectionDir: file.collectionDir,
      fileName: file.fileName
    });
    return result?.collection ?? null;
  });

  // Downloads a collection from a remote URL and imports it into the local database.
  handle('collections:importFromUrl', ipcArgSchemas.collectionImportUrl, async (_event, url) => {
    const win = BrowserWindow.getFocusedWindow();
    const document = await fetchCollectionFromUrl(url);
    const result = await importCollectionFromParsed(db, win, document.parsed, {
      fileName: document.fileName
    });
    if (!result) {
      return null;
    }

    if (!(db instanceof RoutingStorage)) {
      throw new Error('URL import requires the local collection registry.');
    }

    db.setCollectionSourceUrl(result.collection.id, document.sourceUrl);
    return { ...result.collection, sourceUrl: document.sourceUrl };
  });

  // Re-downloads a URL-backed collection and merges remote changes into the local copy.
  handle('collections:refreshFromUrl', ipcArgSchemas.collectionId, async (_event, id) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('URL refresh requires the local collection registry.');
    }

    const collections = await db.listCollections();
    const existing = collections.find((item) => item.id === id);
    const sourceUrl = existing?.sourceUrl?.trim();
    if (!sourceUrl) {
      throw new Error('This collection was not imported from a URL.');
    }

    const document = await fetchCollectionFromUrl(sourceUrl);
    const exportData = convertParsedToCollectionExport(document.parsed, {
      fileName: document.fileName
    });
    const updated = await db.updateCollectionFromImport(id, exportData);
    db.setCollectionSourceUrl(updated.id, sourceUrl);
    return { ...updated, sourceUrl };
  });

  // Searches the apis.io public catalog for Open Collection and Postman Collection artifacts.
  handle(
    'collections:searchPublic',
    ipcArgSchemas.publicCollectionSearch,
    async (_event, query, page) => {
      return searchApisIoCollections(query, page ?? 1);
    }
  );

  // Downloads a public collection and returns a preview summary for the detail modal.
  handle('collections:previewPublic', ipcArgSchemas.publicCollectionRef, async (_event, item) => {
    return previewApisIoCollection(item);
  });

  // Downloads a public collection from apis.io and imports it through the standard pipeline.
  handle('collections:importPublic', ipcArgSchemas.publicCollectionRef, async (_event, item) => {
    const win = BrowserWindow.getFocusedWindow();
    const document = await fetchApisIoCollectionDocument(item);
    const result = await importCollectionFromParsed(db, win, document.parsed, {
      fileName: item.name
    });
    return result?.collection ?? null;
  });

  // Exports a request to a JSON file via a native save dialog.
  handle('requests:export', ipcArgSchemas.requestExport, async (_event, data) => {
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

  // Imports a request from a JSON file selected via a native open dialog.
  handle('requests:import', ipcArgSchemas.requestImport, async (_event, collectionId, folderId) => {
    const win = BrowserWindow.getFocusedWindow();
    const file = await openImportFile(win);
    if (!file) {
      return null;
    }

    const exportData = validateRequestExport(file.parsed);
    const result = await saveImportedRequest(db, win, exportData, collectionId, folderId ?? null);
    return result?.request ?? null;
  });

  // Auto-detects and imports a collection, request, or environment from File -> Import.
  handle(
    'imports:auto',
    ipcArgSchemas.importAuto,
    async (_event, activeCollectionId, pluginExtensions) => {
      logImportVerbose('imports:auto start', {
        activeCollectionId,
        pluginExtensions: pluginExtensions ?? []
      });
      const win = BrowserWindow.getFocusedWindow();
      const file = await openImportFile(win, pluginExtensions ?? []);
      if (!file) {
        logImportVerbose('imports:auto canceled');
        return null;
      }

      let { parsed } = file;

      if (parsed == null && canImportOpenCollection(file.raw)) {
        parsed = parseOpenCollectionDocument(file.raw);
      }

      if (parsed != null) {
        if (isPostmanCollection(parsed)) {
          logImportVerbose('imports:auto classified', { kind: 'postman-collection' });
          const result = await importCollectionFromParsed(db, win, parsed, {
            collectionDir: file.collectionDir,
            fileName: file.fileName
          });
          if (!result) {
            return null;
          }
          return {
            kind: 'collection',
            collection: result.collection,
            action: result.action
          } satisfies ImportEntityResult;
        }

        if (isBrunoCollectionManifest(parsed)) {
          logImportVerbose('imports:auto classified', { kind: 'bruno-collection' });
          const result = await importCollectionFromParsed(db, win, parsed, {
            collectionDir: file.collectionDir,
            fileName: file.fileName
          });
          if (!result) {
            return null;
          }
          return {
            kind: 'collection',
            collection: result.collection,
            action: result.action
          } satisfies ImportEntityResult;
        }

        if (isHarArchive(parsed)) {
          logImportVerbose('imports:auto classified', { kind: 'har-archive' });
          const result = await importCollectionFromParsed(db, win, parsed, {
            collectionDir: file.collectionDir,
            fileName: file.fileName
          });
          if (!result) {
            return null;
          }
          return {
            kind: 'collection',
            collection: result.collection,
            action: result.action
          } satisfies ImportEntityResult;
        }

        if (isOpenCollection(parsed)) {
          logImportVerbose('imports:auto classified', { kind: 'opencollection' });
          const result = await importCollectionFromParsed(db, win, parsed, {
            collectionDir: file.collectionDir,
            fileName: file.fileName
          });
          if (!result) {
            return null;
          }
          return {
            kind: 'collection',
            collection: result.collection,
            action: result.action
          } satisfies ImportEntityResult;
        }

        const exportKind = readHarborclientExport(parsed);

        if (exportKind === 'collection') {
          logImportVerbose('imports:auto classified', { kind: 'harborclient-collection' });
          const result = await importCollectionFromParsed(db, win, parsed, {
            collectionDir: file.collectionDir,
            fileName: file.fileName
          });
          if (!result) {
            return null;
          }
          return {
            kind: 'collection',
            collection: result.collection,
            action: result.action
          } satisfies ImportEntityResult;
        }

        if (exportKind === 'environment') {
          logImportVerbose('imports:auto classified', { kind: 'environment' });
          const exportData = validateEnvironmentExport(parsed);
          const environmentResult = await importEnvironmentData(db, win, exportData);
          if (!environmentResult) {
            return null;
          }
          return {
            kind: 'environment',
            environment: environmentResult.environment,
            action: environmentResult.action
          } satisfies ImportEntityResult;
        }

        if (exportKind === 'request') {
          logImportVerbose('imports:auto classified', { kind: 'request' });
          if (activeCollectionId == null) {
            throw new Error('Select a collection before importing a request.');
          }

          const exportData = validateRequestExport(parsed);
          const result = await saveImportedRequest(db, win, exportData, activeCollectionId, null);
          if (!result) {
            return null;
          }
          return {
            kind: 'request',
            request: result.request,
            action: result.action
          } satisfies ImportEntityResult;
        }

        if (exportKind === 'collection-run-results' || exportKind === 'request-run-results') {
          logImportVerbose('imports:auto classified', { kind: 'run-results', exportKind });
          const data = validateRunResultsExport(parsed);
          return {
            kind: 'run-results',
            data
          } satisfies ImportEntityResult;
        }

        if (exportKind === 'snippet') {
          logImportVerbose('imports:auto classified', { kind: 'snippet' });
          const snippetResult = await importSnippetData(db, win, parsed);
          if (!snippetResult) {
            return null;
          }
          return {
            kind: 'snippet',
            snippet: snippetResult.snippet,
            action: snippetResult.action
          } satisfies ImportEntityResult;
        }

        if (exportKind === 'theme') {
          logImportVerbose('imports:auto classified', { kind: 'theme' });
          const themeResult = await importCustomThemeData(win, parsed);
          if (!themeResult) {
            return null;
          }
          return {
            kind: 'theme',
            theme: themeResult.theme,
            action: themeResult.action
          } satisfies ImportEntityResult;
        }

        if (exportKind === 'workspace') {
          logImportVerbose('imports:auto classified', { kind: 'tab-group' });
          const workspaces = await importWorkspaceData(win, parsed);
          if (!workspaces) {
            return null;
          }
          return {
            kind: 'workspace',
            workspaces,
            action: 'created'
          } satisfies ImportEntityResult;
        }

        if (exportKind === 'website') {
          logImportVerbose('imports:auto classified', { kind: 'website' });
          const websiteResult = importWebsiteData(parsed);
          if (!websiteResult) {
            return null;
          }
          return {
            kind: 'website',
            website: websiteResult.website,
            action: websiteResult.action
          } satisfies ImportEntityResult;
        }

        if (exportKind === 'server') {
          logImportVerbose('imports:auto classified', { kind: 'server' });
          const serverResult = importLiveServerData(parsed);
          if (!serverResult) {
            return null;
          }
          return {
            kind: 'server',
            server: serverResult.server,
            action: serverResult.action
          } satisfies ImportEntityResult;
        }
      }

      if (canImportOpenApiSpec(file.raw)) {
        logImportVerbose('imports:auto classified', { kind: 'openapi-spec' });
        return {
          kind: 'openapi-spec',
          file: {
            name: basename(file.filePath),
            path: file.filePath,
            extension: file.extension,
            contents: file.raw
          }
        } satisfies ImportEntityResult;
      }

      logImportVerbose('imports:auto classified', {
        kind: 'plugin-file',
        fileName: basename(file.filePath),
        extension: file.extension
      });
      return {
        kind: 'plugin-file',
        file: {
          name: basename(file.filePath),
          path: file.filePath,
          extension: file.extension,
          contents: file.raw
        }
      } satisfies ImportEntityResult;
    }
  );

  // Moves a collection to a different database connection.
  handle('collections:move', ipcArgSchemas.collectionMove, (_event, id, targetConnectionId) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Collection move is unavailable.');
    }
    return db.moveCollection(id, targetConnectionId);
  });

  // Reorders collections in the sidebar.
  handle('collections:reorder', ipcArgSchemas.collectionReorder, (_event, orderedCollectionIds) => {
    if (!(db instanceof RoutingStorage)) {
      throw new Error('Collection reorder is unavailable.');
    }
    return db.reorderCollections(orderedCollectionIds);
  });

  // Reorders requests and markdown documents together within a folder or collection root.
  handle(
    'collections:reorder-container-items',
    ipcArgSchemas.containerItemsReorder,
    (_event, collectionId, folderId, items) =>
      db.reorderContainerItems(collectionId, folderId, items)
  );

  // Opens a native file picker and returns selected absolute file paths.
  handle('dialog:openFiles', ipcArgSchemas.none, async () => {
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
}
