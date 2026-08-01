/**
 * Shared live-page (website) JSON payload parse/serialize helpers.
 */
import { defaultAuth, normalizeAuth, type AuthConfig } from '@harborclient/core/auth';
import { normalizeVariable } from './collectionData';
import type {
  CreateWebsiteInput,
  KeyValue,
  ScriptRef,
  UpdateWebsiteInput,
  Variable,
  Website,
  WebsiteInjectionScript
} from '@harborclient/core/types';

/**
 * Stored JSON payload for a live page / website row.
 */
export interface LivePagePayloadJson {
  url: string;
  homeUrl: string;
  faviconDataUrl: string | null;
  scripts: WebsiteInjectionScript[];
  preRequestScripts: ScriptRef[];
  postRequestScripts: ScriptRef[];
  variables: Variable[];
  headers: KeyValue[];
  userAgent: string;
  auth: AuthConfig;
}

/**
 * Normalizes a partial key/value row from live-page payload JSON.
 *
 * @param row - Raw header row candidate.
 * @returns Normalized KeyValue, or null when the row is not an object.
 */
function normalizeLivePageKeyValue(row: unknown): KeyValue | null {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const candidate = row as Partial<KeyValue>;
  return {
    key: typeof candidate.key === 'string' ? candidate.key : '',
    value: typeof candidate.value === 'string' ? candidate.value : '',
    enabled: candidate.enabled !== false
  };
}

/**
 * Empty live-page payload used when JSON parse fails or fields are missing.
 *
 * @returns Default live-page payload fields.
 */
export function emptyLivePagePayload(): LivePagePayloadJson {
  return {
    url: 'about:blank',
    homeUrl: 'about:blank',
    faviconDataUrl: null,
    scripts: [],
    preRequestScripts: [],
    postRequestScripts: [],
    variables: [],
    headers: [],
    userAgent: '',
    auth: defaultAuth()
  };
}

/**
 * Parses a live-page payload JSON string.
 *
 * @param raw - Serialized payload column.
 * @returns Normalized live-page payload fields.
 */
export function parseLivePagePayload(raw: string): LivePagePayloadJson {
  try {
    const parsed = JSON.parse(raw) as Partial<LivePagePayloadJson>;
    return {
      url: typeof parsed.url === 'string' ? parsed.url : 'about:blank',
      homeUrl: typeof parsed.homeUrl === 'string' ? parsed.homeUrl : 'about:blank',
      faviconDataUrl:
        typeof parsed.faviconDataUrl === 'string' && parsed.faviconDataUrl.length > 0
          ? parsed.faviconDataUrl
          : null,
      scripts: Array.isArray(parsed.scripts)
        ? parsed.scripts.flatMap((script): WebsiteInjectionScript[] => {
            if (!script || typeof script !== 'object') {
              return [];
            }
            const candidate = script as Partial<WebsiteInjectionScript>;
            if (
              typeof candidate.id !== 'string' ||
              candidate.id.length === 0 ||
              typeof candidate.name !== 'string' ||
              typeof candidate.source !== 'string' ||
              (candidate.runAt !== 'document-start' &&
                candidate.runAt !== 'dom-ready' &&
                candidate.runAt !== 'did-finish-load')
            ) {
              return [];
            }
            return [
              {
                id: candidate.id,
                name: candidate.name,
                enabled: candidate.enabled !== false,
                runAt: candidate.runAt,
                source: candidate.source
              }
            ];
          })
        : [],
      preRequestScripts: Array.isArray(parsed.preRequestScripts)
        ? (parsed.preRequestScripts as ScriptRef[])
        : [],
      postRequestScripts: Array.isArray(parsed.postRequestScripts)
        ? (parsed.postRequestScripts as ScriptRef[])
        : [],
      variables: Array.isArray(parsed.variables)
        ? parsed.variables.map((row) => normalizeVariable((row ?? {}) as Partial<Variable>))
        : [],
      headers: Array.isArray(parsed.headers)
        ? parsed.headers.flatMap((row): KeyValue[] => {
            const normalized = normalizeLivePageKeyValue(row);
            return normalized ? [normalized] : [];
          })
        : [],
      userAgent: typeof parsed.userAgent === 'string' ? parsed.userAgent : '',
      auth: normalizeAuth(parsed.auth ?? defaultAuth())
    };
  } catch {
    return emptyLivePagePayload();
  }
}

/**
 * Builds a serialized live-page payload from create/update input.
 *
 * @param input - Create or update fields.
 * @returns JSON string for the payload column.
 */
export function serializeLivePagePayload(input: CreateWebsiteInput | UpdateWebsiteInput): string {
  const payload: LivePagePayloadJson = {
    url: input.url,
    homeUrl: input.homeUrl,
    faviconDataUrl:
      typeof input.faviconDataUrl === 'string' && input.faviconDataUrl.length > 0
        ? input.faviconDataUrl
        : null,
    scripts: input.scripts ?? [],
    preRequestScripts: input.preRequestScripts ?? [],
    postRequestScripts: input.postRequestScripts ?? [],
    variables: input.variables ?? [],
    headers: input.headers ?? [],
    userAgent: input.userAgent ?? '',
    auth: normalizeAuth(input.auth ?? defaultAuth())
  };
  return JSON.stringify(payload);
}

/**
 * Maps identity columns plus a payload into a {@link Website}.
 *
 * @param row - Identity and timestamp fields.
 * @param payload - Parsed payload fields.
 * @returns Provider-local live page record.
 */
export function livePageFromPayload(
  row: {
    id: number;
    uuid: string;
    name: string;
    createdAt: number;
    updatedAt: number;
  },
  payload: LivePagePayloadJson
): Website {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    url: payload.url,
    homeUrl: payload.homeUrl,
    faviconDataUrl: payload.faviconDataUrl,
    scripts: payload.scripts,
    preRequestScripts: payload.preRequestScripts,
    postRequestScripts: payload.postRequestScripts,
    variables: payload.variables,
    headers: payload.headers,
    userAgent: payload.userAgent,
    auth: payload.auth,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
