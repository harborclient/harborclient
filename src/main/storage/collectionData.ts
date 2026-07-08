import {
  collectionExportSchema,
  environmentExportSchema,
  formatCollectionImportError,
  formatEnvironmentImportError,
  formatRequestImportError,
  formatRunResultsImportError,
  requestExportSchema,
  runResultsExportSchema
} from '#/main/storage/collectionSchemas';
import type { CollectionExport, EnvironmentExport, RequestExport, Variable } from '#/shared/types';
import type { RunResultsExport } from '#/shared/collectionRunner';

export { normalizeVariable } from '#/main/storage/collectionVariables';

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
 * Returns whether a script field contains executable code.
 *
 * @param script - Pre- or post-request script text from an export row.
 * @returns True when the script is non-empty after trimming whitespace.
 */
function hasScript(script: string | undefined): boolean {
  return typeof script === 'string' && script.trim().length > 0;
}

/**
 * Returns whether a validated collection export defines any pre- or post-request scripts.
 *
 * Used to warn users before import because scripts from untrusted files may be malicious
 * and the vm sandbox is not a hard security boundary.
 *
 * @param data - Normalized collection export payload.
 * @returns True when the collection or any request includes a non-empty script.
 */
export function collectionExportContainsScripts(data: CollectionExport): boolean {
  if (hasScript(data.pre_request_script) || hasScript(data.post_request_script)) {
    return true;
  }

  return data.requests.some(
    (req) => hasScript(req.pre_request_script) || hasScript(req.post_request_script)
  );
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

  const result = collectionExportSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid collection file: ${formatCollectionImportError(result.error)}`);
  }

  return result.data;
}

/**
 * Returns whether a validated request export defines any pre- or post-request scripts.
 *
 * @param data - Normalized request export payload.
 * @returns True when the request includes a non-empty script.
 */
export function requestExportContainsScripts(data: RequestExport): boolean {
  return hasScript(data.pre_request_script) || hasScript(data.post_request_script);
}

/**
 * Validates and normalizes imported request export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized request export.
 * @throws When the payload is invalid.
 */
export function validateRequestExport(data: unknown): RequestExport {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid request file: expected a JSON object');
  }

  const result = requestExportSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid request file: ${formatRequestImportError(result.error)}`);
  }

  return result.data;
}

/**
 * Validates and normalizes imported environment export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized environment export.
 * @throws When the payload is invalid.
 */
export function validateEnvironmentExport(data: unknown): EnvironmentExport {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid environment file: expected a JSON object');
  }

  const result = environmentExportSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid environment file: ${formatEnvironmentImportError(result.error)}`);
  }

  return result.data;
}

/**
 * Validates and normalizes imported run-results export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized run-results export.
 * @throws When the payload is invalid.
 */
export function validateRunResultsExport(data: unknown): RunResultsExport {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid run results file: expected a JSON object');
  }

  const result = runResultsExportSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid run results file: ${formatRunResultsImportError(result.error)}`);
  }

  return result.data as RunResultsExport;
}
