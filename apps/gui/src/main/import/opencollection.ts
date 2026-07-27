import { load as parseYaml } from 'js-yaml';
import { randomUUID } from 'crypto';
import { defaultAuth, type AuthConfig } from '@harborclient/core/auth';
import { serializeFormParts } from '@harborclient/core/formData';
import { serializeUrlEncodedParts } from '@harborclient/core/urlencoded';
import { scriptRefsFromLegacyString } from '@harborclient/core/scriptRefs';
import type {
  BodyType,
  CollectionExport,
  ExportedFolder,
  ExportedRequest,
  HttpMethod,
  KeyValue
} from '@harborclient/core/types';

/**
 * HTTP methods HarborClient accepts for saved requests.
 */
const SUPPORTED_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]);

/**
 * Loose OpenCollection key-value row (headers, params, form fields).
 */
interface OpenCollectionKeyValue {
  name?: string;
  value?: string;
  enabled?: boolean;
  type?: string;
}

/**
 * Loose OpenCollection auth block from a request or defaults object.
 */
interface OpenCollectionAuth {
  type?: string;
  username?: string;
  password?: string;
  token?: string;
  grantType?: string;
  accessTokenUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;
  credentialsPlacement?: string;
  clientAuthentication?: string;
}

/**
 * Loose OpenCollection HTTP body block.
 */
interface OpenCollectionBody {
  type?: string;
  data?: string | OpenCollectionKeyValue[];
}

/**
 * Loose OpenCollection HTTP request details.
 */
interface OpenCollectionHttp {
  method?: string;
  url?: string;
  headers?: OpenCollectionKeyValue[];
  params?: OpenCollectionKeyValue[];
  body?: OpenCollectionBody | OpenCollectionBody[];
  auth?: OpenCollectionAuth;
}

/**
 * Loose OpenCollection runtime script entry.
 */
interface OpenCollectionScript {
  type?: string;
  code?: string;
  name?: string;
}

/**
 * Loose OpenCollection runtime block.
 */
interface OpenCollectionRuntime {
  scripts?: OpenCollectionScript[] | Record<string, string>;
}

/**
 * Loose OpenCollection request defaults (collection or folder level).
 */
interface OpenCollectionRequestDefaults {
  headers?: OpenCollectionKeyValue[];
  auth?: OpenCollectionAuth;
  scripts?: OpenCollectionScript[] | Record<string, string>;
}

/**
 * Loose OpenCollection item — HTTP request, folder, or unsupported protocol.
 */
interface OpenCollectionItem {
  info?: {
    type?: string;
    name?: string;
    description?: string | { content?: string };
    seq?: number;
    tags?: string[];
  };
  http?: OpenCollectionHttp;
  grpc?: unknown;
  graphql?: unknown;
  websocket?: unknown;
  items?: OpenCollectionItem[];
  request?: OpenCollectionRequestDefaults;
  runtime?: OpenCollectionRuntime;
  docs?: string | { content?: string };
}

/**
 * Loose OpenCollection root document.
 */
interface OpenCollectionDocument {
  opencollection?: string;
  info?: { name?: string };
  request?: OpenCollectionRequestDefaults;
  items?: OpenCollectionItem[];
  bundled?: boolean;
}

/**
 * Returns whether a parsed value looks like an OpenCollection v1.x document.
 *
 * @param data - Parsed JSON or YAML from an import file.
 * @returns True when `opencollection` is a v1.x string and `info.name` is non-empty.
 */
export function isOpenCollection(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const record = data as OpenCollectionDocument;
  const version = typeof record.opencollection === 'string' ? record.opencollection.trim() : '';
  if (!version.startsWith('1.')) {
    return false;
  }

  const name = record.info?.name;
  return typeof name === 'string' && name.trim().length > 0;
}

/**
 * Parses JSON or YAML text into a plain object for OpenCollection detection.
 *
 * @param text - Raw import file contents.
 * @returns Parsed document object.
 * @throws When the file is empty or not a JSON/YAML object.
 */
function parseDocument(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('The OpenCollection file is empty.');
  }

  if (trimmed.startsWith('{')) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenCollection JSON must be an object.');
    }
    return parsed as Record<string, unknown>;
  }

  const parsed: unknown = parseYaml(trimmed);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('OpenCollection YAML must be an object.');
  }
  return parsed as Record<string, unknown>;
}

/**
 * Returns whether raw file contents look like an OpenCollection v1.x document.
 *
 * Used by File → Import when the dialog left `parsed` null (for example before
 * YAML parsing was available for `.yaml`/`.yml`).
 *
 * @param text - Raw file contents from the host import flow.
 * @returns True when the document declares OpenCollection 1.x with a name.
 */
export function canImportOpenCollection(text: string): boolean {
  try {
    return isOpenCollection(parseDocument(text));
  } catch {
    return false;
  }
}

/**
 * Parses raw OpenCollection file contents into a document object.
 *
 * @param text - Raw JSON or YAML file contents.
 * @returns Parsed document suitable for {@link convertOpenCollection}.
 * @throws When the contents cannot be parsed as an object.
 */
export function parseOpenCollectionDocument(text: string): unknown {
  return parseDocument(text);
}

/**
 * Reads a description or docs field that may be a string or `{ content }` object.
 *
 * @param value - OpenCollection description-like field.
 * @returns Plain text content, or an empty string when absent.
 */
function readDescription(value: string | { content?: string } | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value != null && typeof value === 'object' && typeof value.content === 'string') {
    return value.content;
  }
  return '';
}

/**
 * Maps OpenCollection header or param rows to HarborClient key-value rows.
 *
 * @param rows - Header or query param rows from an OpenCollection request.
 * @returns HarborClient key-value rows with enabled flags.
 */
function convertKeyValues(rows: OpenCollectionKeyValue[] | undefined): KeyValue[] {
  if (!rows) {
    return [];
  }

  return rows
    .filter((row) => typeof row.name === 'string' && row.name.trim().length > 0)
    .map((row) => ({
      key: row.name!.trim(),
      value: typeof row.value === 'string' ? row.value : '',
      enabled: row.enabled !== false
    }));
}

/**
 * Maps OpenCollection auth to HarborClient's AuthConfig shape.
 *
 * Unsupported auth types (apikey, digest, awsv4, oauth1, etc.) fall back to none.
 *
 * @param auth - OpenCollection auth object from a request or defaults block.
 * @returns HarborClient auth configuration.
 */
function convertAuth(auth: OpenCollectionAuth | undefined): AuthConfig {
  const fallback = defaultAuth();
  if (!auth || typeof auth.type !== 'string') {
    return fallback;
  }

  const type = auth.type.trim().toLowerCase();
  if (type === 'none' || type === 'inherit') {
    return fallback;
  }

  if (type === 'bearer') {
    return {
      ...fallback,
      type: 'bearer',
      bearer: { token: typeof auth.token === 'string' ? auth.token : '' }
    };
  }

  if (type === 'basic') {
    return {
      ...fallback,
      type: 'basic',
      basic: {
        username: typeof auth.username === 'string' ? auth.username : '',
        password: typeof auth.password === 'string' ? auth.password : ''
      }
    };
  }

  if (type === 'oauth2') {
    const grantType = typeof auth.grantType === 'string' ? auth.grantType.trim() : '';
    if (grantType === 'client_credentials') {
      const clientAuthValue = auth.credentialsPlacement ?? auth.clientAuthentication;
      return {
        ...fallback,
        type: 'oauth2',
        oauth2: {
          tokenUrl:
            (typeof auth.accessTokenUrl === 'string' ? auth.accessTokenUrl : '') ||
            (typeof auth.tokenUrl === 'string' ? auth.tokenUrl : ''),
          clientId: typeof auth.clientId === 'string' ? auth.clientId : '',
          clientSecret: typeof auth.clientSecret === 'string' ? auth.clientSecret : '',
          scope: typeof auth.scope === 'string' ? auth.scope : '',
          audience: typeof auth.audience === 'string' ? auth.audience : '',
          clientAuth: clientAuthValue === 'header' ? 'header' : 'body'
        }
      };
    }
  }

  return fallback;
}

/**
 * Extracts pre- and post-request scripts from OpenCollection script containers.
 *
 * Supports both array form (`[{ type, code }]`) and record form (`{ 'before-request': code }`).
 *
 * @param scripts - OpenCollection script list or map from runtime or request defaults.
 * @returns Pre-request and post-request script strings.
 */
function convertScripts(scripts: OpenCollectionScript[] | Record<string, string> | undefined): {
  preRequestScript: string;
  postRequestScript: string;
} {
  let preRequestScript = '';
  let postRequestScript = '';

  if (!scripts) {
    return { preRequestScript, postRequestScript };
  }

  if (Array.isArray(scripts)) {
    const preParts: string[] = [];
    const postParts: string[] = [];
    for (const script of scripts) {
      const code = typeof script.code === 'string' ? script.code : '';
      if (!code.trim()) {
        continue;
      }
      const scriptType = typeof script.type === 'string' ? script.type.trim().toLowerCase() : '';
      if (scriptType === 'before-request' || scriptType === 'prerequest') {
        preParts.push(code);
      } else if (
        scriptType === 'after-response' ||
        scriptType === 'tests' ||
        scriptType === 'test'
      ) {
        postParts.push(code);
      }
    }
    return {
      preRequestScript: preParts.join('\n\n'),
      postRequestScript: postParts.join('\n\n')
    };
  }

  if (typeof scripts === 'object') {
    const record = scripts as Record<string, string>;
    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== 'string' || !value.trim()) {
        continue;
      }
      const scriptType = key.trim().toLowerCase();
      if (scriptType === 'before-request' || scriptType === 'prerequest') {
        preRequestScript = value;
      } else if (
        scriptType === 'after-response' ||
        scriptType === 'tests' ||
        scriptType === 'test'
      ) {
        postRequestScript = value;
      }
    }
  }

  return { preRequestScript, postRequestScript };
}

/**
 * Maps an OpenCollection HTTP body to HarborClient body type and serialized content.
 *
 * Array body variants (per-environment) are skipped. Unsupported types return none.
 *
 * @param body - OpenCollection body block, or an array of body variants.
 * @returns HarborClient body type and serialized body string.
 */
function convertBody(body: OpenCollectionBody | OpenCollectionBody[] | undefined): {
  body: string;
  body_type: BodyType;
} {
  if (!body || Array.isArray(body)) {
    return { body: '', body_type: 'none' };
  }

  const type = typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
  if (!type || type === 'none') {
    return { body: '', body_type: 'none' };
  }

  switch (type) {
    case 'json': {
      const raw = typeof body.data === 'string' ? body.data : '';
      return { body: raw, body_type: 'json' };
    }
    case 'text':
    case 'xml': {
      const raw = typeof body.data === 'string' ? body.data : '';
      return { body: raw, body_type: 'text' };
    }
    case 'form-urlencoded': {
      const rows = convertKeyValues(Array.isArray(body.data) ? body.data : undefined);
      return { body: serializeUrlEncodedParts(rows), body_type: 'urlencoded' };
    }
    case 'multipart-form': {
      const parts = (Array.isArray(body.data) ? body.data : [])
        .filter((part) => typeof part.name === 'string' && part.name.trim().length > 0)
        .map((part) => ({
          key: part.name!.trim(),
          value: typeof part.value === 'string' ? part.value : '',
          enabled: part.enabled !== false,
          type: part.type === 'file' ? ('file' as const) : ('text' as const),
          files: [] as string[]
        }));
      return { body: serializeFormParts(parts), body_type: 'multipart' };
    }
    default:
      return { body: '', body_type: 'none' };
  }
}

/**
 * Normalizes and validates an HTTP method from an OpenCollection request.
 *
 * @param method - Raw method string from the http block.
 * @returns Uppercased HarborClient method, or null when unsupported.
 */
function normalizeMethod(method: string | undefined): HttpMethod | null {
  if (typeof method !== 'string') {
    return null;
  }

  const upper = method.trim().toUpperCase() as HttpMethod;
  return SUPPORTED_METHODS.has(upper) ? upper : null;
}

/**
 * Returns whether an item is an OpenCollection folder (has nested items, not an HTTP request).
 *
 * @param item - Candidate collection item.
 * @returns True when the item should be walked as a folder.
 */
function isFolderItem(item: OpenCollectionItem): boolean {
  if (item.http != null || item.grpc != null || item.graphql != null || item.websocket != null) {
    return false;
  }
  const type = typeof item.info?.type === 'string' ? item.info.type.trim().toLowerCase() : '';
  if (type === 'folder') {
    return true;
  }
  return Array.isArray(item.items);
}

/**
 * Returns whether an item is an OpenCollection HTTP request.
 *
 * @param item - Candidate collection item.
 * @returns True when the item has an http block or `info.type` of `http`.
 */
function isHttpItem(item: OpenCollectionItem): boolean {
  if (item.http != null) {
    return true;
  }
  const type = typeof item.info?.type === 'string' ? item.info.type.trim().toLowerCase() : '';
  return type === 'http';
}

/**
 * Converts a single OpenCollection HTTP item into a HarborClient exported request.
 *
 * @param item - OpenCollection item with an http block.
 * @param folder - Immediate parent folder metadata, or null at collection root.
 * @param sortOrder - Position within the collection for sidebar ordering.
 * @returns Exported request row, or null when the method is unsupported.
 */
function convertHttpItem(
  item: OpenCollectionItem,
  folder: Pick<ExportedFolder, 'name' | 'uuid'> | null,
  sortOrder: number
): ExportedRequest | null {
  const http = item.http;
  if (!http) {
    return null;
  }

  const method = normalizeMethod(http.method);
  if (!method) {
    return null;
  }

  const name =
    typeof item.info?.name === 'string' && item.info.name.trim().length > 0
      ? item.info.name.trim()
      : 'Untitled';

  const headers = convertKeyValues(http.headers);
  const { body, body_type } = convertBody(http.body);
  const { preRequestScript, postRequestScript } = convertScripts(item.runtime?.scripts);
  const tags = Array.isArray(item.info?.tags)
    ? item.info.tags.filter(
        (tag): tag is string => typeof tag === 'string' && tag.trim().length > 0
      )
    : [];
  const comment = readDescription(item.info?.description) || readDescription(item.docs) || '';

  return {
    name,
    method,
    url: typeof http.url === 'string' ? http.url : '',
    headers,
    params: convertKeyValues(http.params),
    auth: convertAuth(http.auth),
    body,
    body_type,
    body_raw: null,
    body_raw_open: false,
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: scriptRefsFromLegacyString(preRequestScript),
    post_request_scripts: scriptRefsFromLegacyString(postRequestScript),
    comment,
    tags: tags.join(', '),
    sort_order: sortOrder,
    folder_name: folder?.name ?? null,
    folder_uuid: folder?.uuid ?? null
  };
}

/**
 * Recursively walks OpenCollection items while preserving folder ancestry.
 *
 * Non-HTTP protocols (gRPC, GraphQL, WebSocket, etc.) are skipped.
 *
 * @param items - OpenCollection item array at the current depth.
 * @param parentFolder - Immediate parent folder metadata, or null at collection root.
 * @param folders - Mutable list of nested folder rows in encounter order.
 * @param requests - Mutable list of converted exported requests.
 */
function walkItems(
  items: OpenCollectionItem[] | undefined,
  parentFolder: Pick<ExportedFolder, 'name' | 'uuid'> | null,
  folders: ExportedFolder[],
  requests: ExportedRequest[]
): void {
  if (!items) {
    return;
  }

  let folderSortOrder = 0;
  for (const item of items) {
    if (isFolderItem(item)) {
      const segment = typeof item.info?.name === 'string' ? item.info.name.trim() : '';
      if (!segment) {
        walkItems(item.items, parentFolder, folders, requests);
        continue;
      }

      const folder: ExportedFolder = {
        uuid: randomUUID(),
        name: segment,
        parent_folder_uuid: parentFolder?.uuid ?? null,
        sort_order: folderSortOrder
      };
      folderSortOrder += 1;
      folders.push(folder);
      walkItems(item.items, folder, folders, requests);
      continue;
    }

    if (!isHttpItem(item)) {
      continue;
    }

    const converted = convertHttpItem(item, parentFolder, requests.length);
    if (converted) {
      requests.push(converted);
    }
  }
}

/**
 * Converts a bundled OpenCollection document into HarborClient's portable CollectionExport format.
 *
 * Unsupported features (gRPC/GraphQL/WebSocket requests, unsupported auth types, environments,
 * etc.) are omitted. Nested folders retain their parent relationships.
 *
 * @param data - Parsed OpenCollection JSON or YAML document.
 * @returns HarborClient collection export ready for validateCollectionExport.
 * @throws When data is not a recognizable OpenCollection document.
 */
export function convertOpenCollection(data: unknown): CollectionExport {
  if (!isOpenCollection(data)) {
    throw new Error('Invalid OpenCollection file');
  }

  const document = data as OpenCollectionDocument;
  const name = document.info!.name!.trim();

  const folders: ExportedFolder[] = [];
  const requests: ExportedRequest[] = [];
  walkItems(document.items, null, folders, requests);

  const defaults = document.request;
  const { preRequestScript, postRequestScript } = convertScripts(defaults?.scripts);

  return {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    name,
    variables: [],
    headers: convertKeyValues(defaults?.headers),
    auth: convertAuth(defaults?.auth),
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: scriptRefsFromLegacyString(preRequestScript),
    post_request_scripts: scriptRefsFromLegacyString(postRequestScript),
    folders,
    requests
  };
}
