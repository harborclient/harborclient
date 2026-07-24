import type { RunResultsExport } from '../collectionRunner';
import type { CollectionExport, EnvironmentExport, RequestExport, Variable } from '../types';
import type { SnippetExport } from '../types/snippet';
import { maskVariablesForExport } from './validate';

/**
 * Options controlling how a HarborClient portable export is serialized to JSON.
 */
export interface StringifyExportOptions {
  /**
   * When true, emit indented JSON with a trailing newline style via `JSON.stringify` spacing.
   * Defaults to true.
   */
  pretty?: boolean;

  /**
   * When true, clear non-shared variable values before serialization.
   * Defaults to false so hosts that already mask keep current behavior.
   */
  maskPrivateVariables?: boolean;
}

/**
 * Resolves stringify options with filestore defaults.
 *
 * @param options - Caller-supplied stringify options.
 * @returns Normalized pretty and mask flags.
 */
function resolveStringifyOptions(options?: StringifyExportOptions): {
  pretty: boolean;
  maskPrivateVariables: boolean;
} {
  return {
    pretty: options?.pretty !== false,
    maskPrivateVariables: options?.maskPrivateVariables === true
  };
}

/**
 * Serializes a value to JSON text using the resolved pretty setting.
 *
 * @param value - Portable export payload ready for serialization.
 * @param pretty - Whether to indent with two spaces.
 * @returns UTF-8 JSON string.
 */
function serializeJson(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

/**
 * Optionally masks private variables on a collection-shaped payload.
 *
 * @param variables - Variables from a collection or environment export.
 * @param maskPrivateVariables - Whether to clear non-shared values.
 * @returns Variables ready for serialization.
 */
function maybeMaskVariables(variables: Variable[], maskPrivateVariables: boolean): Variable[] {
  return maskPrivateVariables ? maskVariablesForExport(variables) : variables;
}

/**
 * Serializes a HarborClient collection export to JSON text.
 *
 * @param data - Validated collection export payload.
 * @param options - Pretty-print and variable masking options.
 * @returns UTF-8 JSON string for the portable collection envelope.
 */
export function stringifyCollection(
  data: CollectionExport,
  options?: StringifyExportOptions
): string {
  const { pretty, maskPrivateVariables } = resolveStringifyOptions(options);
  const payload: CollectionExport = {
    ...data,
    variables: maybeMaskVariables(data.variables, maskPrivateVariables),
    folders: data.folders?.map((folder) => ({
      ...folder,
      variables: folder.variables
        ? maybeMaskVariables(folder.variables, maskPrivateVariables)
        : folder.variables
    }))
  };
  return serializeJson(payload, pretty);
}

/**
 * Serializes a HarborClient request export to JSON text.
 *
 * @param data - Validated request export payload.
 * @param options - Pretty-print options (`maskPrivateVariables` is ignored).
 * @returns UTF-8 JSON string for the portable request envelope.
 */
export function stringifyRequest(data: RequestExport, options?: StringifyExportOptions): string {
  const { pretty } = resolveStringifyOptions(options);
  return serializeJson(data, pretty);
}

/**
 * Serializes a HarborClient environment export to JSON text.
 *
 * @param data - Validated environment export payload.
 * @param options - Pretty-print and variable masking options.
 * @returns UTF-8 JSON string for the portable environment envelope.
 */
export function stringifyEnvironment(
  data: EnvironmentExport,
  options?: StringifyExportOptions
): string {
  const { pretty, maskPrivateVariables } = resolveStringifyOptions(options);
  const payload: EnvironmentExport = {
    ...data,
    variables: maybeMaskVariables(data.variables, maskPrivateVariables)
  };
  return serializeJson(payload, pretty);
}

/**
 * Serializes a HarborClient run-results export to JSON text.
 *
 * @param data - Validated run-results export payload.
 * @param options - Pretty-print options (`maskPrivateVariables` is ignored).
 * @returns UTF-8 JSON string for the portable run-results envelope.
 */
export function stringifyRunResults(
  data: RunResultsExport,
  options?: StringifyExportOptions
): string {
  const { pretty } = resolveStringifyOptions(options);
  return serializeJson(data, pretty);
}

/**
 * Serializes a HarborClient snippet export to JSON text.
 *
 * @param data - Validated snippet export payload.
 * @param options - Pretty-print options (`maskPrivateVariables` is ignored).
 * @returns UTF-8 JSON string for the portable snippet envelope.
 */
export function stringifySnippet(data: SnippetExport, options?: StringifyExportOptions): string {
  const { pretty } = resolveStringifyOptions(options);
  return serializeJson(data, pretty);
}
