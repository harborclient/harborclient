import type { Variable } from '#/shared/types';

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
