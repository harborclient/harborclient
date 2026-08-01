import type { ImportAction, LiveServer } from '@harborclient/core/types';
import {
  defaultLiveServerCorsSettings,
  defaultLiveServerSslSettings,
  validateLiveServerExport
} from '@harborclient/core/types/liveServer';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';

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
 * @returns Import result, or null when validation fails.
 */
export function importLiveServerData(parsed: unknown): LiveServerImportResult | null {
  let exportData;
  try {
    exportData = validateLiveServerExport(parsed);
  } catch {
    return null;
  }

  const database = getLocalDatabase();
  const existing = database.listLiveServers().find((item) => item.uuid === exportData.uuid);
  const aliases = exportData.aliases ?? [];
  const watch = exportData.watch !== false;
  const cors = exportData.cors ?? defaultLiveServerCorsSettings();
  const openPath = exportData.openPath ?? '/';
  const rememberLastUrl = exportData.rememberLastUrl === true;
  const lastOpenedPath = exportData.lastOpenedPath ?? null;
  const indexFiles = exportData.indexFiles ?? ['index.html'];
  const host = exportData.host ?? '127.0.0.1';
  const headers = exportData.headers ?? [];
  const routes = exportData.routes ?? [];
  const proxies = exportData.proxies ?? [];
  const ssl = exportData.ssl ?? defaultLiveServerSslSettings();
  const runCommand = exportData.runCommand ?? '';
  const restartOnCrash = exportData.restartOnCrash === true;
  const urlVariable = exportData.urlVariable ?? '';
  const preRequestScripts = exportData.pre_request_scripts ?? [];
  const postRequestScripts = exportData.post_request_scripts ?? [];

  if (existing) {
    const items = database.updateLiveServer({
      id: existing.id,
      name: exportData.name,
      root: exportData.root,
      port: exportData.port,
      aliases,
      watch,
      cors,
      openPath,
      rememberLastUrl,
      lastOpenedPath,
      indexFiles,
      host,
      headers,
      routes,
      proxies,
      ssl,
      runCommand,
      restartOnCrash,
      urlVariable,
      preRequestScripts,
      postRequestScripts
    });
    const server = items.find((item) => item.id === existing.id);
    if (!server) {
      return null;
    }
    return { server, action: 'updated' };
  }

  const items = database.createLiveServer({
    uuid: exportData.uuid,
    name: exportData.name,
    root: exportData.root,
    port: exportData.port,
    aliases,
    watch,
    cors,
    openPath,
    rememberLastUrl,
    lastOpenedPath,
    indexFiles,
    host,
    headers,
    routes,
    proxies,
    ssl,
    runCommand,
    restartOnCrash,
    urlVariable,
    preRequestScripts,
    postRequestScripts
  });
  const server = items.find((item) => item.uuid === exportData.uuid);
  if (!server) {
    return null;
  }
  return { server, action: 'created' };
}
