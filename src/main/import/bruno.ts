import { parseCollection, parseRequest } from '@usebruno/filestore';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
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
 * Directory names always skipped when walking a Bruno collection tree.
 */
const DEFAULT_IGNORED_DIRS = new Set(['node_modules', '.git', 'environments']);

/**
 * Basenames that are metadata files, not HTTP request definitions.
 */
const SKIPPED_BASENAMES = new Set(['bruno.json', 'collection.bru', 'folder.bru']);

/**
 * Loose Bruno collection manifest from bruno.json.
 */
interface BrunoManifest {
  type?: string;
  name?: string;
  version?: string | number;
  ignore?: string[];
}

/**
 * Loose Bruno auth block from filestore parse output.
 */
interface BrunoAuth {
  mode?: string;
  bearer?: { token?: string };
  basic?: { username?: string; password?: string };
  oauth2?: {
    grantType?: string;
    accessTokenUrl?: string;
    tokenUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    audience?: string;
    credentialsPlacement?: string;
  };
}

/**
 * Loose Bruno key-value row from filestore parse output.
 */
interface BrunoKeyValue {
  name?: string;
  key?: string;
  value?: string;
  enabled?: boolean;
  disabled?: boolean;
  type?: string;
}

/**
 * Loose Bruno multipart form row from filestore parse output.
 */
interface BrunoMultipartPart {
  name?: string;
  value?: string;
  enabled?: boolean;
  disabled?: boolean;
  type?: string;
}

/**
 * Loose Bruno request body from filestore parse output.
 */
interface BrunoBody {
  mode?: string;
  json?: string;
  text?: string;
  xml?: string;
  formUrlEncoded?: BrunoKeyValue[];
  multipartForm?: BrunoMultipartPart[];
}

/**
 * Loose Bruno parsed HTTP request from filestore.
 */
interface BrunoParsedRequest {
  type?: string;
  name?: string;
  docs?: string;
  request?: {
    method?: string;
    url?: string;
    headers?: BrunoKeyValue[];
    params?: BrunoKeyValue[];
    auth?: BrunoAuth;
    body?: BrunoBody;
    script?: { req?: string; res?: string };
    tests?: string;
    docs?: string;
  };
}

/**
 * Loose Bruno parsed collection.bru root from filestore.
 */
interface BrunoParsedCollection {
  meta?: { name?: string };
  request?: {
    headers?: BrunoKeyValue[];
    auth?: BrunoAuth;
    script?: { req?: string; res?: string };
    vars?: { req?: BrunoKeyValue[] };
    tests?: string;
  };
  docs?: string;
}

/**
 * Returns whether a parsed JSON value looks like a Bruno collection manifest.
 *
 * @param data - Parsed JSON from bruno.json or an import file picker selection.
 * @returns True when `type` is `collection` and `name` is a non-empty string.
 */
export function isBrunoCollectionManifest(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const record = data as BrunoManifest;
  if (record.type !== 'collection') {
    return false;
  }

  return typeof record.name === 'string' && record.name.trim().length > 0;
}

/**
 * Returns whether a directory contains a valid Bruno collection manifest.
 *
 * @param dirPath - Absolute path to a candidate Bruno collection folder.
 * @returns True when `bruno.json` exists and passes manifest validation.
 */
export function isBrunoCollectionDirectory(dirPath: string): boolean {
  const manifestPath = join(dirPath, 'bruno.json');
  if (!existsSync(manifestPath)) {
    return false;
  }

  try {
    const raw = readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return isBrunoCollectionManifest(parsed);
  } catch {
    return false;
  }
}

/**
 * Reads ignore patterns from a Bruno manifest, falling back to defaults.
 *
 * @param manifest - Parsed bruno.json manifest.
 * @returns Directory names to skip while walking the collection tree.
 */
function readIgnorePatterns(manifest: BrunoManifest): Set<string> {
  const patterns = new Set(DEFAULT_IGNORED_DIRS);
  if (Array.isArray(manifest.ignore)) {
    for (const entry of manifest.ignore) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        patterns.add(entry.trim());
      }
    }
  }
  return patterns;
}

/**
 * Returns whether a directory entry should be skipped during collection walk.
 *
 * @param entryName - Base name of the directory entry.
 * @param ignorePatterns - Ignore list from the Bruno manifest.
 * @returns True when the entry must not be descended into or parsed.
 */
function shouldIgnoreEntry(entryName: string, ignorePatterns: Set<string>): boolean {
  return ignorePatterns.has(entryName);
}

/**
 * Maps Bruno auth output to HarborClient's AuthConfig shape.
 *
 * Unsupported Bruno auth modes fall back to none so collection auth can inherit at send time.
 *
 * @param auth - Bruno auth object from filestore parse output.
 * @returns HarborClient auth configuration.
 */
function convertAuth(auth: BrunoAuth | undefined): AuthConfig {
  const fallback = defaultAuth();
  if (!auth) {
    return fallback;
  }

  let mode = typeof auth.mode === 'string' ? auth.mode : '';
  if (!mode || mode === 'none') {
    if (auth.bearer) {
      mode = 'bearer';
    } else if (auth.basic) {
      mode = 'basic';
    } else if (auth.oauth2) {
      mode = 'oauth2';
    }
  }

  if (!mode || mode === 'none' || mode === 'inherit') {
    return fallback;
  }

  if (mode === 'bearer') {
    return {
      ...fallback,
      type: 'bearer',
      bearer: { token: typeof auth.bearer?.token === 'string' ? auth.bearer.token : '' }
    };
  }

  if (mode === 'basic') {
    return {
      ...fallback,
      type: 'basic',
      basic: {
        username: typeof auth.basic?.username === 'string' ? auth.basic.username : '',
        password: typeof auth.basic?.password === 'string' ? auth.basic.password : ''
      }
    };
  }

  if (mode === 'oauth2') {
    const oauth2 = auth.oauth2;
    if (oauth2?.grantType === 'client_credentials') {
      const clientAuthValue = oauth2.credentialsPlacement;
      return {
        ...fallback,
        type: 'oauth2',
        oauth2: {
          tokenUrl:
            (typeof oauth2.accessTokenUrl === 'string' ? oauth2.accessTokenUrl : '') ||
            (typeof oauth2.tokenUrl === 'string' ? oauth2.tokenUrl : ''),
          clientId: typeof oauth2.clientId === 'string' ? oauth2.clientId : '',
          clientSecret: typeof oauth2.clientSecret === 'string' ? oauth2.clientSecret : '',
          scope: typeof oauth2.scope === 'string' ? oauth2.scope : '',
          audience: typeof oauth2.audience === 'string' ? oauth2.audience : '',
          clientAuth: clientAuthValue === 'header' ? 'header' : 'body'
        }
      };
    }
  }

  return fallback;
}

/**
 * Maps Bruno header or param rows to HarborClient key-value rows.
 *
 * @param rows - Header or query param rows from filestore parse output.
 * @returns HarborClient key-value rows with enabled flags.
 */
function convertKeyValues(rows: BrunoKeyValue[] | undefined): KeyValue[] {
  if (!rows) {
    return [];
  }

  return rows
    .filter((row) => {
      const key = typeof row.name === 'string' ? row.name : row.key;
      return typeof key === 'string' && key.trim().length > 0;
    })
    .map((row) => {
      const key = (typeof row.name === 'string' ? row.name : row.key)!.trim();
      const enabled = row.disabled === true ? false : row.enabled !== false;
      return {
        key,
        value: typeof row.value === 'string' ? row.value : '',
        enabled
      };
    });
}

/**
 * Maps Bruno query params to HarborClient query parameter rows.
 *
 * Path params remain embedded in the URL string; only query rows are exported.
 *
 * @param params - Param rows from filestore parse output.
 * @returns HarborClient query parameter rows.
 */
function convertQueryParams(params: BrunoKeyValue[] | undefined): KeyValue[] {
  if (!params) {
    return [];
  }

  return convertKeyValues(params.filter((param) => param.type !== 'path'));
}

/**
 * Maps a Bruno request body to HarborClient body type and serialized body content.
 *
 * @param body - Bruno body block from filestore parse output.
 * @param headers - Converted request headers used to infer JSON bodies.
 * @returns HarborClient body type and serialized body string.
 */
function convertBody(body: BrunoBody | undefined): { body: string; body_type: BodyType } {
  if (!body || typeof body.mode !== 'string' || body.mode === 'none') {
    return { body: '', body_type: 'none' };
  }

  switch (body.mode) {
    case 'json': {
      const raw = typeof body.json === 'string' ? body.json : '';
      return { body: raw, body_type: 'json' };
    }
    case 'text':
      return { body: typeof body.text === 'string' ? body.text : '', body_type: 'text' };
    case 'xml':
      return { body: typeof body.xml === 'string' ? body.xml : '', body_type: 'text' };
    case 'formUrlEncoded': {
      const rows = convertKeyValues(body.formUrlEncoded);
      return { body: serializeUrlEncodedParts(rows), body_type: 'urlencoded' };
    }
    case 'multipartForm': {
      const parts = (body.multipartForm ?? [])
        .filter((part) => typeof part.name === 'string' && part.name.trim().length > 0)
        .map((part) => ({
          key: part.name!.trim(),
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
 * Normalizes and validates an HTTP method from a Bruno request.
 *
 * @param method - Raw method string from Bruno filestore output.
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
 * Maps Bruno collection variables to HarborClient variable rows.
 *
 * @param variables - Collection variable rows from collection.bru.
 * @returns HarborClient variables with share enabled.
 */
function convertVariables(variables: BrunoKeyValue[] | undefined): Variable[] {
  if (!variables) {
    return [];
  }

  return variables
    .filter((variable) => typeof variable.name === 'string' && variable.name.trim().length > 0)
    .map((variable) => ({
      key: variable.name!.trim(),
      value: typeof variable.value === 'string' ? variable.value : '',
      defaultValue: '',
      share: true
    }));
}

/**
 * Parses collection.bru when present and returns collection-level settings.
 *
 * @param collectionDir - Absolute path to the Bruno collection root.
 * @returns Parsed collection.bru content, or null when the file is absent.
 */
function readCollectionBru(collectionDir: string): BrunoParsedCollection | null {
  const collectionBruPath = join(collectionDir, 'collection.bru');
  if (!existsSync(collectionBruPath)) {
    return null;
  }

  try {
    const content = readFileSync(collectionBruPath, 'utf-8');
    return parseCollection(content, { format: 'bru' }) as BrunoParsedCollection;
  } catch {
    return null;
  }
}

/**
 * Parses a Bruno request file and returns a converted exported request when supported.
 *
 * @param filePath - Absolute path to a .bru or .yml request file.
 * @param folderPath - Flattened folder path for the request, or null at collection root.
 * @param sortOrder - Position within the collection for sidebar ordering.
 * @returns Exported request row, or null when the file is not a supported HTTP request.
 */
function convertRequestFile(
  filePath: string,
  folderPath: string | null,
  sortOrder: number
): ExportedRequest | null {
  const ext = extname(filePath).toLowerCase();
  if (ext !== '.bru' && ext !== '.yml' && ext !== '.yaml') {
    return null;
  }

  const format = ext === '.bru' ? 'bru' : 'yml';
  let parsed: BrunoParsedRequest;
  try {
    const content = readFileSync(filePath, 'utf-8');
    parsed = parseRequest(content, { format }) as BrunoParsedRequest;
  } catch {
    return null;
  }

  if (parsed.type !== 'http-request' || !parsed.request) {
    return null;
  }

  const method = normalizeMethod(parsed.request.method);
  if (!method) {
    return null;
  }

  const name =
    typeof parsed.name === 'string' && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : basename(filePath, ext);

  const headers = convertKeyValues(parsed.request.headers);
  const { body, body_type } = convertBody(parsed.request.body);
  const preRequestScript =
    typeof parsed.request.script?.req === 'string' ? parsed.request.script.req : '';
  const postRequestScript =
    (typeof parsed.request.script?.res === 'string' ? parsed.request.script.res : '') ||
    (typeof parsed.request.tests === 'string' ? parsed.request.tests : '');

  const comment =
    typeof parsed.request.docs === 'string'
      ? parsed.request.docs
      : typeof parsed.docs === 'string'
        ? parsed.docs
        : '';

  return {
    name,
    method,
    url: typeof parsed.request.url === 'string' ? parsed.request.url : '',
    headers,
    params: convertQueryParams(parsed.request.params),
    auth: convertAuth(parsed.request.auth),
    body,
    body_type,
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    comment,
    sort_order: sortOrder,
    folder_name: folderPath
  };
}

/**
 * Recursively walks a Bruno collection directory and collects converted requests.
 *
 * HarborClient supports only one folder level, so nested paths are joined with " / ".
 *
 * @param currentDir - Absolute path to the directory being walked.
 * @param folderPath - Accumulated folder path from ancestor directories.
 * @param ignorePatterns - Directory names to skip during traversal.
 * @param folders - Mutable list of unique flattened folder names in encounter order.
 * @param requests - Mutable list of converted exported requests.
 */
function walkCollectionDir(
  currentDir: string,
  folderPath: string | null,
  ignorePatterns: Set<string>,
  folders: ExportedFolder[],
  requests: ExportedRequest[]
): void {
  let entries;
  try {
    entries = readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (shouldIgnoreEntry(entry.name, ignorePatterns)) {
      continue;
    }

    const entryPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      const nextPath =
        entry.name.trim().length > 0
          ? folderPath
            ? `${folderPath} / ${entry.name}`
            : entry.name
          : folderPath;
      walkCollectionDir(entryPath, nextPath, ignorePatterns, folders, requests);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (SKIPPED_BASENAMES.has(entry.name)) {
      continue;
    }

    const ext = extname(entry.name).toLowerCase();
    if (ext !== '.bru' && ext !== '.yml' && ext !== '.yaml') {
      continue;
    }

    const converted = convertRequestFile(entryPath, folderPath, requests.length);
    if (!converted) {
      continue;
    }

    if (folderPath && !folders.some((folder) => folder.name === folderPath)) {
      folders.push({ name: folderPath, sort_order: folders.length });
    }

    requests.push(converted);
  }
}

/**
 * Converts a Bruno on-disk collection into HarborClient's portable CollectionExport format.
 *
 * Unsupported Bruno features (GraphQL/gRPC/WebSocket requests, unsupported auth types,
 * file bodies, environments, etc.) are omitted. Nested folders are flattened to a single level.
 *
 * @param collectionDir - Absolute path to the Bruno collection root directory.
 * @param manifest - Parsed bruno.json manifest object.
 * @returns HarborClient collection export ready for validateCollectionExport.
 * @throws When manifest is invalid or collectionDir is missing.
 */
export function convertBrunoCollection(collectionDir: string, manifest: unknown): CollectionExport {
  if (!isBrunoCollectionManifest(manifest)) {
    throw new Error('Invalid Bruno collection manifest');
  }

  if (!existsSync(collectionDir)) {
    throw new Error('Invalid Bruno collection directory');
  }

  const manifestRecord = manifest as BrunoManifest;
  const collectionBru = readCollectionBru(collectionDir);
  const manifestName = manifestRecord.name!.trim();
  const bruName = collectionBru?.meta?.name?.trim();
  const name = bruName && bruName.length > 0 ? bruName : manifestName;

  const folders: ExportedFolder[] = [];
  const requests: ExportedRequest[] = [];
  const ignorePatterns = readIgnorePatterns(manifestRecord);
  walkCollectionDir(collectionDir, null, ignorePatterns, folders, requests);

  const collectionRequest = collectionBru?.request;
  const preRequestScript =
    typeof collectionRequest?.script?.req === 'string' ? collectionRequest.script.req : '';
  const postRequestScript =
    (typeof collectionRequest?.script?.res === 'string' ? collectionRequest.script.res : '') ||
    (typeof collectionRequest?.tests === 'string' ? collectionRequest.tests : '');

  return {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    name,
    variables: convertVariables(collectionRequest?.vars?.req),
    headers: convertKeyValues(collectionRequest?.headers),
    auth: convertAuth(collectionRequest?.auth),
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    folders,
    requests
  };
}
