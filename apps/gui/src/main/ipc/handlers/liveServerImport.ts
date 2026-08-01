import type { ImportAction, LiveServer } from '@harborclient/core/types';
import {
  defaultLiveServerCorsSettings,
  defaultLiveServerSslSettings,
  validateLiveServerExport
} from '@harborclient/core/types/liveServer';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';

/**
 * Result of importing a live-server export into the local registry.
 */
export interface LiveServerImportResult {
  /**
   * Imported or updated live-server row.
   */
  server: LiveServer;

  /**
   * Whether the live server was created or updated.
   */
  action: ImportAction;
}

/**
 * Imports a HarborClient live-server export into the local registry.
 *
 * When a live server with the same uuid already exists it is updated in place;
 * otherwise a new live server is created.
 *
 * @param parsed - Parsed JSON payload from the import file.
 * @param db - Active storage facade used for routed imports.
 * @returns Import result, or null when validation fails.
 */
export async function importLiveServerData(
  parsed: unknown,
  db: IStorage
): Promise<LiveServerImportResult | null> {
  let exportData;
  try {
    exportData = validateLiveServerExport(parsed);
  } catch {
    return null;
  }

  const router = db instanceof RoutingStorage ? db : null;
  const database = getLocalDatabase();
  const existing = (router ? await router.listLiveServers() : database.listLiveServers()).find(
    (item) => item.uuid === exportData.uuid
  );
  const aliases = exportData.aliases ?? [];
  const watch = exportData.watch !== false;
  const cors = exportData.cors ?? defaultLiveServerCorsSettings();
  const openPath = exportData.openPath ?? '/';
  const openPathOnStartup = exportData.openPathOnStartup !== false;
  const rememberLastUrl = exportData.rememberLastUrl === true;
  const lastOpenedPath = exportData.lastOpenedPath ?? null;
  const indexFiles = exportData.indexFiles ?? ['index.html'];
  const host = exportData.host ?? '127.0.0.1';
  const headers = exportData.headers ?? [];
  const routes = exportData.routes ?? [];
  const errorPages = exportData.errorPages ?? [];
  const proxies = exportData.proxies ?? [];
  const ssl = exportData.ssl ?? defaultLiveServerSslSettings();
  const runCommand = exportData.runCommand ?? '';
  const restartOnCrash = exportData.restartOnCrash === true;
  const urlVariable = exportData.urlVariable ?? '';
  const preRequestScripts = exportData.pre_request_scripts ?? [];
  const postRequestScripts = exportData.post_request_scripts ?? [];

  if (existing) {
    const server = router
      ? await router.updateLiveServer({
          id: existing.id,
          name: exportData.name,
          root: exportData.root,
          port: exportData.port,
          aliases,
          watch,
          cors,
          openPath,
          openPathOnStartup,
          rememberLastUrl,
          lastOpenedPath,
          indexFiles,
          host,
          headers,
          routes,
          errorPages,
          proxies,
          ssl,
          runCommand,
          restartOnCrash,
          urlVariable,
          preRequestScripts,
          postRequestScripts
        })
      : database
          .updateLiveServer({
            id: existing.id,
            name: exportData.name,
            root: exportData.root,
            port: exportData.port,
            aliases,
            watch,
            cors,
            openPath,
            openPathOnStartup,
            rememberLastUrl,
            lastOpenedPath,
            indexFiles,
            host,
            headers,
            routes,
            errorPages,
            proxies,
            ssl,
            runCommand,
            restartOnCrash,
            urlVariable,
            preRequestScripts,
            postRequestScripts
          })
          .find((item) => item.id === existing.id);
    if (!server) {
      return null;
    }
    return { server, action: 'updated' };
  }

  const server = router
    ? await router.createLiveServer({
        uuid: exportData.uuid,
        name: exportData.name,
        root: exportData.root,
        port: exportData.port,
        aliases,
        watch,
        cors,
        openPath,
        openPathOnStartup,
        rememberLastUrl,
        lastOpenedPath,
        indexFiles,
        host,
        headers,
        routes,
        errorPages,
        proxies,
        ssl,
        runCommand,
        restartOnCrash,
        urlVariable,
        preRequestScripts,
        postRequestScripts
      })
    : database
        .createLiveServer({
          uuid: exportData.uuid,
          name: exportData.name,
          root: exportData.root,
          port: exportData.port,
          aliases,
          watch,
          cors,
          openPath,
          openPathOnStartup,
          rememberLastUrl,
          lastOpenedPath,
          indexFiles,
          host,
          headers,
          routes,
          errorPages,
          proxies,
          ssl,
          runCommand,
          restartOnCrash,
          urlVariable,
          preRequestScripts,
          postRequestScripts
        })
        .find((item) => item.uuid === exportData.uuid);
  if (!server) {
    return null;
  }
  return { server, action: 'created' };
}
