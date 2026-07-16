import type { Variable } from './types';

/**
 * Merges two environment variable lists; override rows win on duplicate keys.
 *
 * @param baseVariables - Lower-precedence variables (typically the bottom environment).
 * @param overrideVariables - Higher-precedence variables (typically the top environment).
 * @returns Combined variable list with stable insertion order.
 */
export function mergeEnvironmentVariables(
  baseVariables: Variable[],
  overrideVariables: Variable[]
): Variable[] {
  const map = new Map<string, Variable>();
  for (const variable of baseVariables) {
    const key = variable.key.trim();
    if (key) {
      map.set(key, variable);
    }
  }
  for (const variable of overrideVariables) {
    const key = variable.key.trim();
    if (key) {
      map.set(key, variable);
    }
  }
  return Array.from(map.values());
}

/**
 * Result of appending source variables that are missing from a target list.
 */
export interface AppendMissingEnvironmentVariablesResult {
  /**
   * Combined list: all target rows, then newly appended source rows.
   */
  variables: Variable[];

  /**
   * Number of source rows appended (keys that were absent from the target).
   */
  addedCount: number;
}

/**
 * Appends variables from a source list onto a target list when the key is missing.
 *
 * Existing target rows are left unchanged. Blank or whitespace-only keys are
 * ignored. When the source repeats a key, only the first eligible row is added.
 *
 * @param targetVariables - Variables that already exist (typically the bottom environment).
 * @param sourceVariables - Variables to copy from (typically the top environment).
 * @returns Updated list and how many rows were appended.
 */
export function appendMissingEnvironmentVariables(
  targetVariables: Variable[],
  sourceVariables: Variable[]
): AppendMissingEnvironmentVariablesResult {
  const knownKeys = new Set<string>();
  const variables: Variable[] = [];

  for (const variable of targetVariables) {
    const key = variable.key.trim();
    if (key) {
      knownKeys.add(key);
    }
    variables.push(variable);
  }

  let addedCount = 0;
  for (const variable of sourceVariables) {
    const key = variable.key.trim();
    if (!key || knownKeys.has(key)) {
      continue;
    }
    knownKeys.add(key);
    variables.push(variable);
    addedCount += 1;
  }

  return { variables, addedCount };
}
