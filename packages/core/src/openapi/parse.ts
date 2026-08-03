import { load as parseYaml } from 'js-yaml';
import type { BodyType, RequestProtocol } from '../types/common';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

/**
 * Media type key used by OpenAPI to declare Server-Sent Events responses.
 */
const EVENT_STREAM_MEDIA_TYPE = 'text/event-stream';

type HttpMethodName = (typeof HTTP_METHODS)[number];

/**
 * Parsed OpenAPI document shape used by the import workflow.
 */
export interface ParsedOpenApiSpec {
  /**
   * API title from `info.title`, or a fallback label.
   */
  title: string;

  /**
   * Resolved server base URL, if present.
   */
  baseUrl: string;

  /**
   * Flattened operations ready for preview and import.
   */
  operations: ParsedOpenApiOperation[];
}

/**
 * One HTTP operation extracted from an OpenAPI paths object.
 */
export interface ParsedOpenApiOperation {
  /**
   * Stable id for selection state in the import UI.
   */
  id: string;

  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * HTTP method in uppercase.
   */
  method: string;

  /**
   * Absolute or root-relative request URL.
   */
  url: string;

  /**
   * Folder name derived from the first OpenAPI tag.
   */
  folder?: string;

  /**
   * Optional request body string.
   */
  body?: string;

  /**
   * HarborClient body encoding for the generated request.
   */
  bodyType?: BodyType;

  /**
   * Header map extracted from operation parameters.
   */
  headers?: Record<string, string>;

  /**
   * Query parameters extracted from operation parameters.
   */
  params?: Array<{ key: string; value: string }>;

  /**
   * Transport protocol; `sse` when a response declares `text/event-stream`.
   */
  protocol?: RequestProtocol;

  /**
   * OpenAPI operation description stored as a request comment.
   */
  comment?: string;
}

/**
 * Request row accepted by host bulk collection creation from OpenAPI import.
 */
export interface OpenApiCreateCollectionRequest {
  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * HTTP method in uppercase.
   */
  method: string;

  /**
   * Request URL including scheme, host, and path.
   */
  url: string;

  /**
   * Outgoing request headers as a flat key/value map.
   */
  headers?: Record<string, string>;

  /**
   * Enabled query parameters for the request.
   */
  params?: Array<{ key: string; value: string }>;

  /**
   * Request body content as a string.
   */
  body?: string;

  /**
   * Request body encoding.
   */
  bodyType?: BodyType;

  /**
   * Folder name within the new collection.
   */
  folder?: string;

  /**
   * Transport protocol; `sse` when the operation streams Server-Sent Events.
   */
  protocol?: RequestProtocol;

  /**
   * Free-form notes stored on the saved request.
   */
  comment?: string;
}

/**
 * Parses an OpenAPI 3.x document from JSON or YAML text.
 *
 * @param text - Raw file contents from the picked spec file.
 * @returns Parsed title, base URL, and flattened operations.
 */
export function parseOpenApiSpec(text: string): ParsedOpenApiSpec {
  const document = parseDocument(text);
  assertOpenApiVersion(document);

  const title = readInfoTitle(document);
  const baseUrl = readBaseUrl(document);
  const operations = flattenOperations(document, baseUrl);

  if (operations.length === 0) {
    throw new Error('No HTTP operations were found in the OpenAPI document.');
  }

  return { title, baseUrl, operations };
}

/**
 * Returns whether raw file contents look like an OpenAPI 3.x document.
 *
 * Used by File → Import to avoid claiming unrelated JSON or YAML files.
 *
 * @param text - Raw file contents from the host import flow.
 * @returns True when the document declares OpenAPI 3.x.
 */
export function canImportOpenApiSpec(text: string): boolean {
  try {
    const document = parseDocument(text);
    const version = typeof document.openapi === 'string' ? document.openapi.trim() : '';
    return version.startsWith('3.');
  } catch {
    return false;
  }
}

/**
 * Parses JSON or YAML text into a plain object.
 *
 * @param text - Raw spec file contents.
 * @returns Parsed document object.
 */
function parseDocument(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('The OpenAPI file is empty.');
  }

  try {
    if (trimmed.startsWith('{')) {
      const parsed: unknown = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('OpenAPI JSON must be an object.');
      }
      return parsed as Record<string, unknown>;
    }

    const parsed: unknown = parseYaml(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAPI YAML must be an object.');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse OpenAPI document: ${message}`, { cause: error });
  }
}

/**
 * Ensures the document declares an OpenAPI 3.x version.
 *
 * @param document - Parsed OpenAPI root object.
 */
function assertOpenApiVersion(document: Record<string, unknown>): void {
  const version = typeof document.openapi === 'string' ? document.openapi.trim() : '';
  if (!version.startsWith('3.')) {
    throw new Error('Only OpenAPI 3.x documents are supported.');
  }
}

/**
 * Reads the API title from `info.title`.
 *
 * @param document - Parsed OpenAPI root object.
 * @returns Trimmed title or a generic fallback.
 */
function readInfoTitle(document: Record<string, unknown>): string {
  const info = document.info;
  if (info && typeof info === 'object') {
    const title = (info as { title?: unknown }).title;
    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
  }
  return 'Imported API';
}

/**
 * Reads the first server URL from the spec.
 *
 * @param document - Parsed OpenAPI root object.
 * @returns Trimmed server URL without a trailing slash.
 */
function readBaseUrl(document: Record<string, unknown>): string {
  const servers = document.servers;
  if (!Array.isArray(servers) || servers.length === 0) {
    return '';
  }

  const first = servers[0];
  if (!first || typeof first !== 'object') {
    return '';
  }

  const url = (first as { url?: unknown }).url;
  if (typeof url !== 'string') {
    return '';
  }

  return url.trim().replace(/\/+$/, '');
}

/**
 * Flattens all path items into importable operations.
 *
 * @param document - Parsed OpenAPI root object.
 * @param baseUrl - Resolved server base URL.
 * @returns Operation rows sorted by folder, path, and method.
 */
function flattenOperations(
  document: Record<string, unknown>,
  baseUrl: string
): ParsedOpenApiOperation[] {
  const paths = document.paths;
  if (!paths || typeof paths !== 'object') {
    return [];
  }

  const operations: ParsedOpenApiOperation[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    const sharedParameters = readParameters(pathItem);

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method];
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const operationObject = operation as Record<string, unknown>;
      const mergedParameters = [...sharedParameters, ...readParameters(operationObject)];
      const body = readRequestBody(operationObject);
      const name = readOperationName(operationObject, method, path);
      const folder = readFirstTag(operationObject);
      const comment = readDescription(operationObject);
      const isSse = operationHasEventStreamResponse(operationObject);
      const headers = ensureSseAcceptHeader(readHeaderParameters(mergedParameters), isSse);

      operations.push({
        id: `${method}:${path}:${name}`,
        name,
        method: method.toUpperCase(),
        url: joinUrl(baseUrl, path),
        folder,
        body: body.body,
        bodyType: body.bodyType,
        headers,
        params: readQueryParameters(mergedParameters),
        ...(isSse ? { protocol: 'sse' as const } : {}),
        comment
      });
    }
  }

  return operations.sort((left, right) => {
    const folderCompare = (left.folder ?? '').localeCompare(right.folder ?? '');
    if (folderCompare !== 0) {
      return folderCompare;
    }
    const urlCompare = left.url.localeCompare(right.url);
    if (urlCompare !== 0) {
      return urlCompare;
    }
    return left.method.localeCompare(right.method);
  });
}

/**
 * Returns whether an OpenAPI operation declares a Server-Sent Events response.
 *
 * Looks for `text/event-stream` under any response's `content` map (OpenAPI 3.0/3.1
 * convention and OpenAPI 3.2 sequential media types).
 *
 * @param operation - OpenAPI operation object for a single method.
 * @returns True when at least one response uses the event-stream media type.
 */
function operationHasEventStreamResponse(operation: Record<string, unknown>): boolean {
  const responses = operation.responses;
  if (!responses || typeof responses !== 'object') {
    return false;
  }

  for (const response of Object.values(responses as Record<string, unknown>)) {
    if (!response || typeof response !== 'object') {
      continue;
    }

    const content = (response as { content?: unknown }).content;
    if (!content || typeof content !== 'object') {
      continue;
    }

    for (const mediaType of Object.keys(content as Record<string, unknown>)) {
      if (mediaType.trim().toLowerCase().includes(EVENT_STREAM_MEDIA_TYPE)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Ensures SSE operations carry an Accept header for event streams.
 *
 * Leaves existing Accept values unchanged so parameter examples from the spec win.
 *
 * @param headers - Header map from OpenAPI parameters, or undefined when empty.
 * @param isSse - Whether the operation was classified as Server-Sent Events.
 * @returns Header map with Accept set when needed, or undefined when still empty.
 */
function ensureSseAcceptHeader(
  headers: Record<string, string> | undefined,
  isSse: boolean
): Record<string, string> | undefined {
  if (!isSse) {
    return headers;
  }

  const next = { ...(headers ?? {}) };
  const hasAccept = Object.keys(next).some((key) => key.trim().toLowerCase() === 'accept');
  if (!hasAccept) {
    next.Accept = EVENT_STREAM_MEDIA_TYPE;
  }

  return next;
}

/**
 * Builds a display name for an operation.
 *
 * @param operation - OpenAPI operation object.
 * @param method - Lowercase HTTP method name.
 * @param path - Path template from the spec.
 * @returns Operation id, summary, or a method/path fallback.
 */
function readOperationName(
  operation: Record<string, unknown>,
  method: HttpMethodName,
  path: string
): string {
  const operationId = operation.operationId;
  if (typeof operationId === 'string' && operationId.trim()) {
    return operationId.trim();
  }

  const summary = operation.summary;
  if (typeof summary === 'string' && summary.trim()) {
    return summary.trim();
  }

  return `${method.toUpperCase()} ${path}`;
}

/**
 * Reads the first tag used as a folder name.
 *
 * @param operation - OpenAPI operation object.
 * @returns Trimmed first tag, if any.
 */
function readFirstTag(operation: Record<string, unknown>): string | undefined {
  const tags = operation.tags;
  if (!Array.isArray(tags) || tags.length === 0) {
    return undefined;
  }

  const first = tags[0];
  if (typeof first !== 'string' || !first.trim()) {
    return undefined;
  }

  return first.trim();
}

/**
 * Reads an operation or path-item description for request comments.
 *
 * @param operation - OpenAPI operation object.
 * @returns Trimmed description text.
 */
function readDescription(operation: Record<string, unknown>): string | undefined {
  const description = operation.description;
  if (typeof description === 'string' && description.trim()) {
    return description.trim();
  }
  return undefined;
}

/**
 * Reads parameter objects from a path item or operation.
 *
 * @param container - OpenAPI path item or operation object.
 * @returns Parameter objects declared on the container.
 */
function readParameters(container: Record<string, unknown>): Array<Record<string, unknown>> {
  const parameters = container.parameters;
  if (!Array.isArray(parameters)) {
    return [];
  }

  return parameters.filter(
    (parameter): parameter is Record<string, unknown> =>
      Boolean(parameter) && typeof parameter === 'object'
  );
}

/**
 * Converts header parameters into a flat header map.
 *
 * @param parameters - Merged OpenAPI parameter objects.
 * @returns Header names mapped to example or empty values.
 */
function readHeaderParameters(
  parameters: Array<Record<string, unknown>>
): Record<string, string> | undefined {
  const headers: Record<string, string> = {};

  for (const parameter of parameters) {
    const location = parameter.in;
    const name = parameter.name;
    if (location !== 'header' || typeof name !== 'string' || !name.trim()) {
      continue;
    }

    headers[name.trim()] = readParameterExample(parameter);
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

/**
 * Converts query parameters into HarborClient param rows.
 *
 * @param parameters - Merged OpenAPI parameter objects.
 * @returns Query parameter key/value pairs.
 */
function readQueryParameters(
  parameters: Array<Record<string, unknown>>
): Array<{ key: string; value: string }> | undefined {
  const params: Array<{ key: string; value: string }> = [];

  for (const parameter of parameters) {
    const location = parameter.in;
    const name = parameter.name;
    if (location !== 'query' || typeof name !== 'string' || !name.trim()) {
      continue;
    }

    params.push({
      key: name.trim(),
      value: readParameterExample(parameter)
    });
  }

  return params.length > 0 ? params : undefined;
}

/**
 * Reads an example or default value from a parameter definition.
 *
 * @param parameter - OpenAPI parameter object.
 * @returns Example string suitable for a generated request.
 */
function readParameterExample(parameter: Record<string, unknown>): string {
  const directExample = parameter.example;
  if (directExample != null) {
    return stringifyExample(directExample);
  }

  const schema = parameter.schema;
  if (schema && typeof schema === 'object') {
    const schemaExample = (schema as { example?: unknown; default?: unknown }).example;
    if (schemaExample != null) {
      return stringifyExample(schemaExample);
    }
    const schemaDefault = (schema as { default?: unknown }).default;
    if (schemaDefault != null) {
      return stringifyExample(schemaDefault);
    }
  }

  return '';
}

/**
 * Extracts a JSON or text request body from an operation.
 *
 * @param operation - OpenAPI operation object.
 * @returns Body text and HarborClient body type when present.
 */
function readRequestBody(operation: Record<string, unknown>): {
  body?: string;
  bodyType?: BodyType;
} {
  const requestBody = operation.requestBody;
  if (!requestBody || typeof requestBody !== 'object') {
    return {};
  }

  const content = (requestBody as { content?: unknown }).content;
  if (!content || typeof content !== 'object') {
    return {};
  }

  const jsonContent = (content as Record<string, unknown>)['application/json'];
  if (jsonContent && typeof jsonContent === 'object') {
    const body = readJsonContent(jsonContent as Record<string, unknown>);
    if (body) {
      return { body, bodyType: 'json' };
    }
  }

  const textContent =
    (content as Record<string, unknown>)['text/plain'] ??
    (content as Record<string, unknown>)['text/html'];
  if (textContent && typeof textContent === 'object') {
    const example = (textContent as { example?: unknown }).example;
    if (example != null) {
      return { body: stringifyExample(example), bodyType: 'text' };
    }
  }

  return {};
}

/**
 * Builds a JSON request body from content examples or schemas.
 *
 * @param jsonContent - OpenAPI JSON media type object.
 * @returns JSON string or undefined when no body could be inferred.
 */
function readJsonContent(jsonContent: Record<string, unknown>): string | undefined {
  const example = jsonContent.example;
  if (example != null) {
    return stringifyExample(example);
  }

  const examples = jsonContent.examples;
  if (examples && typeof examples === 'object') {
    const first = Object.values(examples)[0];
    if (first && typeof first === 'object') {
      const value = (first as { value?: unknown }).value;
      if (value != null) {
        return stringifyExample(value);
      }
    }
  }

  const schema = jsonContent.schema;
  if (schema && typeof schema === 'object') {
    const sample = sampleFromSchema(schema as Record<string, unknown>);
    if (sample != null) {
      return JSON.stringify(sample, null, 2);
    }
  }

  return undefined;
}

/**
 * Generates a conservative sample value from a JSON schema object.
 *
 * @param schema - OpenAPI schema object.
 * @returns Sample JSON-compatible value.
 */
function sampleFromSchema(schema: Record<string, unknown>): unknown {
  const directExample = schema.example;
  if (directExample != null) {
    return directExample;
  }

  const schemaDefault = schema.default;
  if (schemaDefault != null) {
    return schemaDefault;
  }

  const schemaType = schema.type;
  if (schemaType === 'object' && schema.properties && typeof schema.properties === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (propertySchema && typeof propertySchema === 'object') {
        result[key] = sampleFromSchema(propertySchema as Record<string, unknown>);
      } else {
        result[key] = '';
      }
    }
    return result;
  }

  if (schemaType === 'array') {
    const items = schema.items;
    if (items && typeof items === 'object') {
      return [sampleFromSchema(items as Record<string, unknown>)];
    }
    return [];
  }

  if (schemaType === 'boolean') {
    return false;
  }
  if (schemaType === 'integer' || schemaType === 'number') {
    return 0;
  }

  return '';
}

/**
 * Serializes an example value for use in generated requests.
 *
 * @param value - Example value from the OpenAPI document.
 * @returns String representation for headers, params, or bodies.
 */
function stringifyExample(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Joins a server base URL and path template.
 *
 * @param baseUrl - Server URL from the spec.
 * @param path - Path template beginning with `/`.
 * @returns Combined URL string.
 */
function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl) {
    return path;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Maps parsed operations into host createCollection request rows.
 *
 * @param operations - Selected operations from the import preview.
 * @returns Request rows accepted by bulk collection creation.
 */
export function operationsToCreateRequests(
  operations: ParsedOpenApiOperation[]
): OpenApiCreateCollectionRequest[] {
  return operations.map((operation) => ({
    name: operation.name,
    method: operation.method,
    url: operation.url,
    headers: operation.headers,
    params: operation.params,
    body: operation.body,
    bodyType: operation.bodyType,
    folder: operation.folder,
    ...(operation.protocol === 'sse' ? { protocol: 'sse' as const } : {}),
    comment: operation.comment
  }));
}
