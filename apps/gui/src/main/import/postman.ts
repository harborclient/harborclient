import { defaultAuth, type AuthConfig } from '@harborclient/core/auth';
import { createHash } from 'crypto';
import { serializeFormParts } from '@harborclient/core/formData';
import { serializeUrlEncodedParts } from '@harborclient/core/urlencoded';
import type {
  BodyType,
  CollectionExport,
  ExportedFolder,
  ExportedRequest,
  HttpMethod,
  KeyValue,
  Variable
} from '@harborclient/core/types';
import { scriptRefsFromLegacyString } from '@harborclient/core/scriptRefs';
import { headersIndicateSse } from './detectSse';

/**
 * HarborClient UUID namespace seed for deterministic Postman import ids.
 *
 * Postman exports do not carry stable request/folder ids across fetch cycles, so we derive
 * UUIDs from structural paths so URL refresh can upsert instead of duplicating rows.
 */
const POSTMAN_IMPORT_NAMESPACE = 'harborclient-postman-import-v1';

/**
 * Builds a deterministic UUID from a stable seed string.
 *
 * @param seed - Stable identity string (for example folder path or request fingerprint).
 * @returns RFC 4122 variant UUID string suitable for export validation.
 */
function uuidFromSeed(seed: string): string {
  const hash = createHash('sha256').update(`${POSTMAN_IMPORT_NAMESPACE}:${seed}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
 * Loose Postman auth block from a collection or request export.
 */
interface PostmanAuth {
  type?: string;
  bearer?: Array<{ key?: string; value?: string }>;
  basic?: Array<{ key?: string; value?: string }>;
  oauth2?: Array<{ key?: string; value?: string }>;
}

/**
 * Loose Postman query or path-variable row from a structured URL export.
 */
interface PostmanUrlParam {
  key?: string;
  value?: string;
  disabled?: boolean;
}

/**
 * Loose Postman URL object from a request export.
 *
 * Classic Collection v2.1 exports usually include `raw`. OpenAPI-derived
 * collections often omit it and only provide structured `host` / `path` /
 * `query` / `variable` parts.
 */
interface PostmanUrlObject {
  raw?: string;
  protocol?: string;
  host?: string | string[];
  port?: string;
  path?: string | string[];
  query?: PostmanUrlParam[];
  variable?: PostmanUrlParam[];
  hash?: string;
}

/**
 * Loose Postman URL object or string from a request export.
 */
type PostmanUrl = string | PostmanUrlObject;

/**
 * Loose Postman body block from a request export.
 */
interface PostmanBody {
  mode?: string;
  raw?: string;
  urlencoded?: Array<{ key?: string; value?: string; disabled?: boolean }>;
  formdata?: Array<{
    key?: string;
    value?: string;
    type?: string;
    disabled?: boolean;
  }>;
  options?: { raw?: { language?: string } };
}

/**
 * Loose Postman script event from a collection or request export.
 */
interface PostmanEvent {
  listen?: string;
  script?: { exec?: string | string[] };
}

/**
 * Loose Postman request block nested under an item.
 */
interface PostmanRequest {
  method?: string;
  header?: Array<{ key?: string; value?: string; disabled?: boolean }>;
  url?: PostmanUrl;
  auth?: PostmanAuth;
  body?: PostmanBody;
  description?: string;
}

/**
 * Loose Postman item node — either a folder (has `item`) or a request (has `request`).
 */
interface PostmanItem {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
  event?: PostmanEvent[];
  auth?: PostmanAuth;
}

/**
 * Loose Postman collection export root document.
 */
interface PostmanCollection {
  info?: { name?: string; _postman_id?: string; schema?: string };
  item?: PostmanItem[];
  auth?: PostmanAuth;
  event?: PostmanEvent[];
  variable?: Array<{ key?: string; value?: string }>;
}

/**
 * Returns whether a parsed JSON value looks like a Postman collection export.
 *
 * @param data - Parsed JSON from an import file.
 * @returns True when `info._postman_id` is a string or the schema URL references Postman.
 */
export function isPostmanCollection(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const record = data as Record<string, unknown>;
  const info = record.info;
  if (info != null && typeof info === 'object') {
    const infoRecord = info as Record<string, unknown>;
    if (typeof infoRecord._postman_id === 'string' && infoRecord._postman_id.trim().length > 0) {
      return true;
    }

    const schema = infoRecord.schema;
    if (typeof schema === 'string' && schema.toLowerCase().includes('getpostman.com')) {
      return true;
    }
  }

  return false;
}

/**
 * Reads a key-value array field from a Postman auth block.
 *
 * @param entries - Postman auth field list (e.g. bearer or basic credentials).
 * @param key - Field key to look up.
 * @returns The matching value string, or an empty string when absent.
 */
function readAuthField(
  entries: Array<{ key?: string; value?: string }> | undefined,
  key: string
): string {
  if (!entries) {
    return '';
  }

  const match = entries.find((entry) => entry.key === key);
  return typeof match?.value === 'string' ? match.value : '';
}

/**
 * Maps a Postman auth block to HarborClient's AuthConfig shape.
 *
 * Unsupported Postman auth types (apikey, oauth2 authorization code, etc.) fall back to none.
 *
 * @param auth - Postman auth object from a collection or request.
 * @returns HarborClient auth configuration.
 */
function convertAuth(auth: PostmanAuth | undefined): AuthConfig {
  const fallback = defaultAuth();
  if (!auth || typeof auth.type !== 'string') {
    return fallback;
  }

  if (auth.type === 'bearer') {
    return {
      ...fallback,
      type: 'bearer',
      bearer: { token: readAuthField(auth.bearer, 'token') }
    };
  }

  if (auth.type === 'basic') {
    return {
      ...fallback,
      type: 'basic',
      basic: {
        username: readAuthField(auth.basic, 'username'),
        password: readAuthField(auth.basic, 'password')
      }
    };
  }

  if (auth.type === 'oauth2') {
    const grantType = readAuthField(auth.oauth2, 'grant_type');
    if (grantType === 'client_credentials') {
      const clientAuthValue = readAuthField(auth.oauth2, 'client_authentication');
      return {
        ...fallback,
        type: 'oauth2',
        oauth2: {
          tokenUrl:
            readAuthField(auth.oauth2, 'accessTokenUrl') ||
            readAuthField(auth.oauth2, 'tokenUrl') ||
            readAuthField(auth.oauth2, 'accessToken'),
          clientId: readAuthField(auth.oauth2, 'clientId'),
          clientSecret: readAuthField(auth.oauth2, 'clientSecret'),
          scope: readAuthField(auth.oauth2, 'scope'),
          audience: readAuthField(auth.oauth2, 'audience'),
          clientAuth: clientAuthValue === 'header' ? 'header' : 'body'
        }
      };
    }
  }

  return fallback;
}

/**
 * Joins Postman script exec lines into a single script string.
 *
 * @param exec - Script body from a Postman event (string or line array).
 * @returns Joined script text, or an empty string when absent.
 */
function joinScriptExec(exec: string | string[] | undefined): string {
  if (typeof exec === 'string') {
    return exec;
  }

  if (Array.isArray(exec)) {
    return exec.join('\n');
  }

  return '';
}

/**
 * Extracts pre- and post-request scripts from Postman event listeners.
 *
 * @param events - Postman event array from a collection or request.
 * @returns Pre-request and post-request script strings.
 */
function convertEvents(events: PostmanEvent[] | undefined): {
  preRequestScript: string;
  postRequestScript: string;
} {
  let preRequestScript = '';
  let postRequestScript = '';

  if (!events) {
    return { preRequestScript, postRequestScript };
  }

  for (const event of events) {
    const script = joinScriptExec(event.script?.exec);
    if (event.listen === 'prerequest') {
      preRequestScript = script;
    } else if (event.listen === 'test') {
      postRequestScript = script;
    }
  }

  return { preRequestScript, postRequestScript };
}

/**
 * Maps Postman collection variables to HarborClient variable rows.
 *
 * @param variables - Postman collection variable list.
 * @returns HarborClient variables with share enabled.
 */
function convertVariables(
  variables: Array<{ key?: string; value?: string }> | undefined
): Variable[] {
  if (!variables) {
    return [];
  }

  return variables
    .filter((v) => typeof v.key === 'string' && v.key.trim().length > 0)
    .map((v) => ({
      key: v.key!.trim(),
      value: typeof v.value === 'string' ? v.value : '',
      defaultValue: '',
      enabled: true,
      share: true
    }));
}

/**
 * Joins Postman host segments the same way Collection v2.1 exports do.
 *
 * @param host - Host string or dotted segment list from a Postman URL object.
 * @returns Hostname (or variable host) without protocol or port.
 */
function joinPostmanHost(host: string | string[] | undefined): string {
  if (typeof host === 'string') {
    return host.trim();
  }

  if (!Array.isArray(host)) {
    return '';
  }

  return host
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('.');
}

/**
 * Normalizes Postman path segments, applying path-variable values when present.
 *
 * Segments already written as `:id` or `{{id}}` are left alone when the matching
 * variable has no useful value, matching OpenAPI→Postman exports that keep the
 * placeholder in `path` and document defaults under `variable`.
 *
 * @param path - Path string or segment list from a Postman URL object.
 * @param variables - Path variable definitions from the same URL object.
 * @returns Path segments ready to join with `/`.
 */
function resolvePostmanPathSegments(
  path: string | string[] | undefined,
  variables: PostmanUrlParam[] | undefined
): string[] {
  const segments =
    typeof path === 'string'
      ? path.split('/').filter((segment) => segment.length > 0)
      : Array.isArray(path)
        ? path.filter((segment): segment is string => typeof segment === 'string')
        : [];

  const valuesByKey = new Map<string, string>();
  for (const variable of variables ?? []) {
    if (variable.disabled === true) {
      continue;
    }
    if (typeof variable.key !== 'string' || variable.key.trim().length === 0) {
      continue;
    }
    if (typeof variable.value !== 'string') {
      continue;
    }
    const trimmed = variable.value.trim();
    // OpenAPI→Postman placeholders are often a single space or `<string>`; keep
    // the `:name` / `{{name}}` path segment instead of substituting those.
    if (trimmed.length === 0 || /^<[^>]+>$/.test(trimmed)) {
      continue;
    }
    valuesByKey.set(variable.key.trim(), variable.value);
  }

  return segments.map((segment) => {
    const colonMatch = /^:([A-Za-z0-9_-]+)$/.exec(segment);
    if (colonMatch) {
      const replacement = valuesByKey.get(colonMatch[1]!);
      return replacement !== undefined ? replacement : segment;
    }

    const mustacheMatch = /^\{\{([A-Za-z0-9_-]+)\}\}$/.exec(segment);
    if (mustacheMatch) {
      const replacement = valuesByKey.get(mustacheMatch[1]!);
      return replacement !== undefined ? replacement : segment;
    }

    return segment;
  });
}

/**
 * Builds a query string from Postman URL query rows.
 *
 * @param query - Query parameter list from a Postman URL object.
 * @returns Query string without a leading `?`, or an empty string when none apply.
 */
function buildPostmanQueryString(query: PostmanUrlParam[] | undefined): string {
  if (!query?.length) {
    return '';
  }

  const parts: string[] = [];
  for (const param of query) {
    if (param.disabled === true) {
      continue;
    }
    if (typeof param.key !== 'string' || param.key.length === 0) {
      continue;
    }
    const value = typeof param.value === 'string' ? param.value : '';
    parts.push(`${param.key}=${value}`);
  }

  return parts.join('&');
}

/**
 * Rebuilds a URL string from structured Postman URL parts when `raw` is absent.
 *
 * @param url - Structured Postman URL object without a usable `raw` field.
 * @returns Reconstructed URL, or an empty string when host and path are both empty.
 */
function buildUrlFromParts(url: PostmanUrlObject): string {
  const host = joinPostmanHost(url.host);
  const pathSegments = resolvePostmanPathSegments(url.path, url.variable);
  const path = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '';

  let authority = host;
  if (typeof url.port === 'string' && url.port.trim().length > 0 && host.length > 0) {
    authority = `${host}:${url.port.trim()}`;
  }

  let result = '';
  if (typeof url.protocol === 'string' && url.protocol.trim().length > 0 && authority.length > 0) {
    result = `${url.protocol.trim()}://${authority}${path}`;
  } else {
    result = `${authority}${path}`;
  }

  const query = buildPostmanQueryString(url.query);
  if (query.length > 0) {
    result = result.length > 0 ? `${result}?${query}` : `?${query}`;
  }

  if (typeof url.hash === 'string' && url.hash.length > 0) {
    const hash = url.hash.startsWith('#') ? url.hash : `#${url.hash}`;
    result = `${result}${hash}`;
  }

  return result;
}

/**
 * Resolves a Postman URL object or string to a raw URL string.
 *
 * Prefers `raw` when present. Otherwise rebuilds from `protocol`, `host`, `port`,
 * `path`, `query`, `variable`, and `hash` so OpenAPI-derived collections that omit
 * `raw` still import with usable request URLs.
 *
 * @param url - Postman URL field from a request.
 * @returns Raw URL string suitable for HarborClient storage.
 */
function resolveUrl(url: PostmanUrl | undefined): string {
  if (typeof url === 'string') {
    return url;
  }

  if (url == null || typeof url !== 'object') {
    return '';
  }

  if (typeof url.raw === 'string' && url.raw.length > 0) {
    return url.raw;
  }

  return buildUrlFromParts(url);
}

/**
 * Maps Postman request headers to HarborClient key-value rows.
 *
 * @param headers - Postman header list from a request.
 * @returns HarborClient header rows with enabled flags.
 */
function convertHeaders(
  headers: Array<{ key?: string; value?: string; disabled?: boolean }> | undefined
): KeyValue[] {
  if (!headers) {
    return [];
  }

  return headers
    .filter((h) => typeof h.key === 'string' && h.key.trim().length > 0)
    .map((h) => ({
      key: h.key!.trim(),
      value: typeof h.value === 'string' ? h.value : '',
      enabled: h.disabled !== true
    }));
}

/**
 * Returns whether request headers indicate a JSON body.
 *
 * @param headers - Converted HarborClient header rows.
 * @returns True when Content-Type is application/json.
 */
function headersIndicateJson(headers: KeyValue[]): boolean {
  return headers.some(
    (h) =>
      h.enabled &&
      h.key.trim().toLowerCase() === 'content-type' &&
      h.value.trim().toLowerCase().includes('application/json')
  );
}

/**
 * Maps a Postman request body to HarborClient body type and serialized body content.
 *
 * Unsupported modes (graphql, file, etc.) return body_type none with an empty body.
 *
 * @param body - Postman body block from a request.
 * @param headers - Converted request headers used to infer JSON raw bodies.
 * @returns HarborClient body type and serialized body string.
 */
function convertBody(
  body: PostmanBody | undefined,
  headers: KeyValue[]
): { body: string; body_type: BodyType } {
  if (!body || typeof body.mode !== 'string') {
    return { body: '', body_type: 'none' };
  }

  switch (body.mode) {
    case 'raw': {
      const raw = typeof body.raw === 'string' ? body.raw : '';
      const language = body.options?.raw?.language;
      const body_type: BodyType =
        language === 'json' || headersIndicateJson(headers) ? 'json' : 'text';
      return { body: raw, body_type };
    }
    case 'urlencoded': {
      const rows: KeyValue[] = (body.urlencoded ?? [])
        .filter((part) => typeof part.key === 'string' && part.key.trim().length > 0)
        .map((part) => ({
          key: part.key!.trim(),
          value: typeof part.value === 'string' ? part.value : '',
          enabled: part.disabled !== true
        }));
      return { body: serializeUrlEncodedParts(rows), body_type: 'urlencoded' };
    }
    case 'formdata': {
      const parts = (body.formdata ?? [])
        .filter((part) => typeof part.key === 'string' && part.key.trim().length > 0)
        .map((part) => ({
          key: part.key!.trim(),
          value: typeof part.value === 'string' ? part.value : '',
          enabled: part.disabled !== true,
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
 * Normalizes and validates an HTTP method from a Postman request.
 *
 * @param method - Raw method string from Postman.
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
 * Converts a single Postman request item into a HarborClient exported request.
 *
 * @param item - Postman item node containing a request block.
 * @param folder - Immediate parent folder metadata, or null at collection root.
 * @param folderPath - Slash-delimited folder path used for deterministic request uuids.
 * @param sortOrder - Position within the collection for sidebar ordering.
 * @returns Exported request row, or null when the method is unsupported.
 */
function convertRequestItem(
  item: PostmanItem,
  folder: Pick<ExportedFolder, 'name' | 'uuid'> | null,
  folderPath: string,
  sortOrder: number
): ExportedRequest | null {
  const request = item.request;
  if (!request) {
    return null;
  }

  const method = normalizeMethod(request.method);
  if (!method) {
    return null;
  }

  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Untitled';
  const headers = convertHeaders(request.header);
  const { body, body_type } = convertBody(request.body, headers);
  const { preRequestScript, postRequestScript } = convertEvents(item.event);
  const auth = request.auth ?? item.auth;
  const url = resolveUrl(request.url);

  return {
    uuid: uuidFromSeed(`request:${folderPath}|${method}|${name}|${url}`),
    name,
    method,
    ...(headersIndicateSse(headers) ? { protocol: 'sse' as const } : {}),
    url,
    headers,
    params: [],
    auth: convertAuth(auth),
    body,
    body_type,
    body_raw: null,
    body_raw_open: false,
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: scriptRefsFromLegacyString(preRequestScript),
    post_request_scripts: scriptRefsFromLegacyString(postRequestScript),
    comment: typeof request.description === 'string' ? request.description : '',
    tags: '',
    sort_order: sortOrder,
    folder_name: folder?.name ?? null,
    folder_uuid: folder?.uuid ?? null
  };
}

/**
 * Recursively walks Postman items while preserving folder ancestry.
 *
 * @param items - Postman item array at the current depth.
 * @param parentFolder - Immediate parent folder metadata, or null at collection root.
 * @param parentPath - Slash-delimited path of the parent folder for deterministic uuids.
 * @param folders - Mutable list of nested folder rows in encounter order.
 * @param requests - Mutable list of converted exported requests.
 */
function walkItems(
  items: PostmanItem[] | undefined,
  parentFolder: Pick<ExportedFolder, 'name' | 'uuid'> | null,
  parentPath: string,
  folders: ExportedFolder[],
  requests: ExportedRequest[]
): void {
  if (!items) {
    return;
  }

  let folderSortOrder = 0;
  for (const item of items) {
    if (Array.isArray(item.item)) {
      const segment = typeof item.name === 'string' ? item.name.trim() : '';
      if (!segment) {
        walkItems(item.item, parentFolder, parentPath, folders, requests);
        continue;
      }

      const folderPath = parentPath ? `${parentPath}/${segment}` : segment;
      const folder: ExportedFolder = {
        uuid: uuidFromSeed(`folder:${folderPath}`),
        name: segment,
        parent_folder_uuid: parentFolder?.uuid ?? null,
        sort_order: folderSortOrder
      };
      folderSortOrder += 1;
      folders.push(folder);
      walkItems(item.item, folder, folderPath, folders, requests);
      continue;
    }

    if (item.request) {
      const converted = convertRequestItem(item, parentFolder, parentPath, requests.length);
      if (converted) {
        requests.push(converted);
      }
    }
  }
}

/**
 * Converts a Postman collection export into HarborClient's portable CollectionExport format.
 *
 * Unsupported Postman features (unsupported auth types, GraphQL/file bodies,
 * saved responses, etc.) are omitted. Requests with `Accept: text/event-stream`
 * import as `protocol: 'sse'`. Nested folders retain their parent relationships.
 * Structured URLs without `raw` are rebuilt from host/path/query/path-variable parts.
 * Folder and request uuids are derived deterministically from structural paths so URL
 * refresh can upsert the same entities instead of inserting duplicates.
 *
 * @param data - Parsed Postman collection JSON.
 * @returns HarborClient collection export ready for validateCollectionExport.
 * @throws When data is not a recognizable Postman collection object.
 */
export function convertPostmanCollection(data: unknown): CollectionExport {
  if (!isPostmanCollection(data)) {
    throw new Error('Invalid Postman collection file');
  }

  const collection = data as PostmanCollection;
  const rawName = collection.info?.name;
  const name =
    typeof rawName === 'string' && rawName.trim().length > 0
      ? rawName.trim()
      : 'Imported Collection';

  const folders: ExportedFolder[] = [];
  const requests: ExportedRequest[] = [];
  walkItems(collection.item, null, '', folders, requests);

  const { preRequestScript, postRequestScript } = convertEvents(collection.event);

  return {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    name,
    variables: convertVariables(collection.variable),
    headers: [],
    auth: convertAuth(collection.auth),
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: scriptRefsFromLegacyString(preRequestScript),
    post_request_scripts: scriptRefsFromLegacyString(postRequestScript),
    folders,
    requests
  };
}
