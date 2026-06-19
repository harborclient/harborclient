import type {
  BodyType,
  CollectionExport,
  ExportedRequest,
  HttpMethod,
  KeyValue,
  Variable
} from '#/shared/types';

export const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]);

export const BODY_TYPES = new Set<BodyType>(['none', 'json', 'text']);

/**
 * Coerces a partial or legacy variable record to the full Variable shape.
 *
 * @param v - Raw variable fields from storage or import.
 * @returns Normalized variable with defaults for missing fields.
 */
export function normalizeVariable(v: Partial<Variable>): Variable {
  return {
    key: typeof v.key === 'string' ? v.key : '',
    value: typeof v.value === 'string' ? v.value : '',
    defaultValue: typeof v.defaultValue === 'string' ? v.defaultValue : '',
    share: v.share === true
  };
}

/**
 * Masks private variable values for portable export.
 *
 * @param variables - Collection variables to export.
 * @returns Variables with non-shared values cleared.
 */
export function maskVariablesForExport(variables: Variable[]): Variable[] {
  return variables.map((v) => ({
    key: v.key,
    value: v.share ? v.value : '',
    defaultValue: v.defaultValue,
    share: v.share
  }));
}

/**
 * Validates and normalizes imported collection export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized collection export.
 * @throws When the payload is invalid.
 */
export function validateCollectionExport(data: unknown): CollectionExport {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid collection file: expected a JSON object');
  }

  const record = data as Record<string, unknown>;
  const formatVersion = record.formatVersion;
  if (formatVersion !== 1) {
    throw new Error('Invalid collection file: unsupported format version');
  }

  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name) {
    throw new Error('Invalid collection file: collection name is required');
  }

  if (!Array.isArray(record.requests)) {
    throw new Error('Invalid collection file: requests must be an array');
  }

  const variables = Array.isArray(record.variables)
    ? (record.variables as Partial<Variable>[])
        .map(normalizeVariable)
        .filter((v) => v.key.trim() || v.value.trim() || v.defaultValue.trim())
    : [];

  const headers = Array.isArray(record.headers) ? (record.headers as KeyValue[]) : [];

  const preRequestScript =
    typeof record.pre_request_script === 'string' ? record.pre_request_script : '';
  const postRequestScript =
    typeof record.post_request_script === 'string' ? record.post_request_script : '';

  const requests = record.requests.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid collection file: request ${index + 1} is malformed`);
    }

    const req = item as Record<string, unknown>;
    const method = req.method;
    if (typeof method !== 'string' || !HTTP_METHODS.has(method as HttpMethod)) {
      throw new Error(`Invalid collection file: request ${index + 1} has an invalid method`);
    }

    const bodyType = req.body_type;
    if (typeof bodyType !== 'string' || !BODY_TYPES.has(bodyType as BodyType)) {
      throw new Error(`Invalid collection file: request ${index + 1} has an invalid body type`);
    }

    const requestName = typeof req.name === 'string' ? req.name.trim() : '';
    if (!requestName) {
      throw new Error(`Invalid collection file: request ${index + 1} is missing a name`);
    }

    return {
      name: requestName,
      method: method as HttpMethod,
      url: typeof req.url === 'string' ? req.url : '',
      headers: Array.isArray(req.headers) ? (req.headers as KeyValue[]) : [],
      params: Array.isArray(req.params) ? (req.params as KeyValue[]) : [],
      body: typeof req.body === 'string' ? req.body : '',
      body_type: bodyType as BodyType,
      pre_request_script: typeof req.pre_request_script === 'string' ? req.pre_request_script : '',
      post_request_script:
        typeof req.post_request_script === 'string' ? req.post_request_script : '',
      sort_order: typeof req.sort_order === 'number' ? req.sort_order : index
    } satisfies ExportedRequest;
  });

  return {
    formatVersion: 1,
    name,
    variables,
    headers,
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    requests
  };
}
