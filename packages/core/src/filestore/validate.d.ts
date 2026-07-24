import type { RunResultsExport } from '../collectionRunner';
import type { CollectionExport, EnvironmentExport, RequestExport, Variable } from '../types';
export { normalizeVariable } from './variables';
/**
 * Masks private variable values for portable export.
 *
 * @param variables - Collection variables to export.
 * @returns Variables with non-shared values cleared.
 */
export declare function maskVariablesForExport(variables: Variable[]): Variable[];
/**
 * Returns whether a validated collection export defines any pre- or post-request scripts.
 *
 * Used to warn users before import because scripts from untrusted files may be malicious
 * and the vm sandbox is not a hard security boundary.
 *
 * @param data - Normalized collection export payload.
 * @returns True when the collection or any request includes a non-empty script.
 */
export declare function collectionExportContainsScripts(data: CollectionExport): boolean;
/**
 * Validates and normalizes imported collection export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized collection export.
 * @throws When the payload is invalid.
 */
export declare function validateCollectionExport(data: unknown): CollectionExport;
/**
 * Returns whether a validated request export defines any pre- or post-request scripts.
 *
 * @param data - Normalized request export payload.
 * @returns True when the request includes a non-empty script.
 */
export declare function requestExportContainsScripts(data: RequestExport): boolean;
/**
 * Validates and normalizes imported request export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized request export.
 * @throws When the payload is invalid.
 */
export declare function validateRequestExport(data: unknown): RequestExport;
/**
 * Validates and normalizes imported environment export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized environment export.
 * @throws When the payload is invalid.
 */
export declare function validateEnvironmentExport(data: unknown): EnvironmentExport;
/**
 * Validates and normalizes imported run-results export data.
 *
 * @param data - Parsed JSON payload from an export file.
 * @returns Normalized run-results export.
 * @throws When the payload is invalid.
 */
export declare function validateRunResultsExport(data: unknown): RunResultsExport;
//# sourceMappingURL=validate.d.ts.map
