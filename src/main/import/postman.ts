import { defaultAuth, type AuthConfig } from '#/shared/auth';
import { serializeFormParts } from '#/shared/formData';
import { serializeUrlEncodedParts } from '#/shared/urlencoded';
import type {
  BodyType,
  CollectionExport,
  ExportedFolder,
  ExportedRequest,
  HttpMethod,
  KeyValue,
  Variable
} from '#/shared/types';
import { scriptRefsFromLegacyString } from '#/shared/scriptRefs';

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
 * Loose Postman URL object or string from a request export.
 */
type PostmanUrl = string | { raw?: string };

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
      share: true
    }));
}

/**
 * Resolves a Postman URL object or string to a raw URL string.
 *
 * @param url - Postman URL field from a request.
 * @returns Raw URL string suitable for HarborClient storage.
 */
function resolveUrl(url: PostmanUrl | undefined): string {
  if (typeof url === 'string') {
    return url;
  }

  if (url != null && typeof url === 'object' && typeof url.raw === 'string') {
    return url.raw;
  }

  return '';
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
 * @param folderPath - Flattened folder path for the request, or null at collection root.
 * @param sortOrder - Position within the collection for sidebar ordering.
 * @returns Exported request row, or null when the method is unsupported.
 */
function convertRequestItem(
  item: PostmanItem,
  folderPath: string | null,
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

  return {
    name,
    method,
    url: resolveUrl(request.url),
    headers,
    params: [],
    auth: convertAuth(auth),
    body,
    body_type,
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: scriptRefsFromLegacyString(preRequestScript),
    post_request_scripts: scriptRefsFromLegacyString(postRequestScript),
    comment: typeof request.description === 'string' ? request.description : '',
    tags: '',
    sort_order: sortOrder,
    folder_name: folderPath
  };
}

/**
 * Recursively walks Postman items, flattening nested folders and collecting requests.
 *
 * HarborClient supports only one folder level, so nested paths are joined with " / ".
 *
 * @param items - Postman item array at the current depth.
 * @param folderPath - Accumulated folder path from ancestor folders.
 * @param folders - Mutable list of unique flattened folder names in encounter order.
 * @param requests - Mutable list of converted exported requests.
 */
function walkItems(
  items: PostmanItem[] | undefined,
  folderPath: string | null,
  folders: ExportedFolder[],
  requests: ExportedRequest[]
): void {
  if (!items) {
    return;
  }

  for (const item of items) {
    if (Array.isArray(item.item)) {
      const segment = typeof item.name === 'string' ? item.name.trim() : '';
      const nextPath =
        segment.length > 0 ? (folderPath ? `${folderPath} / ${segment}` : segment) : folderPath;

      walkItems(item.item, nextPath, folders, requests);
      continue;
    }

    if (item.request) {
      if (folderPath && !folders.some((folder) => folder.name === folderPath)) {
        folders.push({ name: folderPath, sort_order: folders.length });
      }

      const converted = convertRequestItem(item, folderPath, requests.length);
      if (converted) {
        requests.push(converted);
      }
    }
  }
}

/**
 * Converts a Postman collection export into HarborClient's portable CollectionExport format.
 *
 * Unsupported Postman features (unsupported auth types, GraphQL/file bodies, path variables,
 * saved responses, etc.) are omitted. Nested folders are flattened to a single level.
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
  walkItems(collection.item, null, folders, requests);

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
