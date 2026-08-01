/**
 * Shared live-server JSON payload parse/serialize helpers for provider and registry rows.
 */
import {
  normalizeLiveServerConfigFields,
  normalizeLiveServerCorsSettings,
  type CreateLiveServerInput,
  type LiveServer,
  type LiveServerAlias,
  type LiveServerScriptRef,
  type UpdateLiveServerInput
} from '@harborclient/core/types';

/**
 * Stored JSON payload for a live server row (everything except identity/timestamps).
 */
export interface LiveServerPayloadJson {
  root: string;
  port: number | null;
  aliases: LiveServerAlias[];
  watch: boolean;
  cors: ReturnType<typeof normalizeLiveServerCorsSettings>;
  openPath: string;
  openPathOnStartup: boolean;
  rememberLastUrl: boolean;
  lastOpenedPath: string | null;
  indexFiles: string[];
  host: string;
  headers: LiveServer['headers'];
  routes: LiveServer['routes'];
  errorPages: LiveServer['errorPages'];
  proxies: LiveServer['proxies'];
  ssl: LiveServer['ssl'];
  runCommand: string;
  restartOnCrash: boolean;
  urlVariable: string;
  preRequestScripts: LiveServerScriptRef[];
  postRequestScripts: LiveServerScriptRef[];
}

/**
 * Returns an empty live-server payload used when stored JSON is corrupt.
 *
 * @returns Normalized empty payload with defaults for all expanded fields.
 */
export function emptyLiveServerPayload(): LiveServerPayloadJson {
  const fields = normalizeLiveServerConfigFields(undefined);
  return {
    root: '',
    port: null,
    aliases: [],
    watch: true,
    cors: normalizeLiveServerCorsSettings(undefined),
    ...fields
  };
}

/**
 * Parses a live-server payload JSON string.
 *
 * @param raw - Serialized payload column.
 * @returns Normalized live-server payload fields.
 */
export function parseLiveServerPayload(raw: string): LiveServerPayloadJson {
  try {
    const parsed = JSON.parse(raw) as Partial<LiveServerPayloadJson>;
    const aliases = Array.isArray(parsed.aliases)
      ? parsed.aliases.flatMap((alias): LiveServerAlias[] => {
          if (!alias || typeof alias !== 'object') {
            return [];
          }
          const candidate = alias as Partial<LiveServerAlias>;
          if (typeof candidate.path !== 'string' || typeof candidate.target !== 'string') {
            return [];
          }
          const path = candidate.path.trim();
          const target = candidate.target.trim();
          if (path === '' || target === '') {
            return [];
          }
          return [{ path, target }];
        })
      : [];
    const port =
      typeof parsed.port === 'number' && Number.isInteger(parsed.port) && parsed.port > 0
        ? parsed.port
        : null;
    const fields = normalizeLiveServerConfigFields(parsed);
    return {
      root: typeof parsed.root === 'string' ? parsed.root : '',
      port,
      aliases,
      watch: parsed.watch !== false,
      cors: normalizeLiveServerCorsSettings(parsed.cors),
      ...fields
    };
  } catch {
    return emptyLiveServerPayload();
  }
}

/**
 * Builds a serialized live-server payload from create/update input.
 *
 * @param input - Create or update fields.
 * @returns JSON string for the payload column.
 */
export function serializeLiveServerPayload(
  input: CreateLiveServerInput | UpdateLiveServerInput
): string {
  const root = input.root.trim();
  const fields = normalizeLiveServerConfigFields(input);
  const payload: LiveServerPayloadJson = {
    root,
    port:
      typeof input.port === 'number' && Number.isInteger(input.port) && input.port > 0
        ? input.port
        : null,
    aliases: (input.aliases ?? [])
      .map((alias) => ({
        path: alias.path.trim(),
        target: alias.target.trim()
      }))
      .filter((alias) => alias.path !== '' && alias.target !== ''),
    watch: input.watch !== false,
    cors: normalizeLiveServerCorsSettings(input.cors),
    ...fields
  };
  return JSON.stringify(payload);
}

/**
 * Maps identity columns plus a payload into a {@link LiveServer}.
 *
 * @param row - Identity and timestamp fields.
 * @param payload - Parsed payload fields.
 * @returns Provider-local live server record.
 */
export function liveServerFromPayload(
  row: {
    id: number;
    uuid: string;
    name: string;
    sortOrder: number;
    createdAt: number;
    updatedAt: number;
  },
  payload: LiveServerPayloadJson
): LiveServer {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    root: payload.root,
    port: payload.port,
    aliases: payload.aliases,
    watch: payload.watch,
    cors: payload.cors,
    openPath: payload.openPath,
    openPathOnStartup: payload.openPathOnStartup,
    rememberLastUrl: payload.rememberLastUrl,
    lastOpenedPath: payload.lastOpenedPath,
    indexFiles: payload.indexFiles,
    host: payload.host,
    headers: payload.headers,
    routes: payload.routes,
    errorPages: payload.errorPages,
    proxies: payload.proxies,
    ssl: payload.ssl,
    runCommand: payload.runCommand,
    restartOnCrash: payload.restartOnCrash,
    urlVariable: payload.urlVariable,
    preRequestScripts: payload.preRequestScripts,
    postRequestScripts: payload.postRequestScripts,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
