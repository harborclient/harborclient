import type { Variable } from '@harborclient/core/types';

/**
 * Merges collection/environment variables with live-page variables.
 *
 * Live-page keys override collection/environment keys on conflict so address-bar
 * and script substitution prefer the website-scoped values.
 *
 * @param baseVariables - Active collection/environment variables.
 * @param livePageVariables - Website-scoped variables from the browser tab.
 * @returns Merged variable list for runtime substitution.
 */
export function mergeLivePageVariables(
  baseVariables: Variable[],
  livePageVariables: Variable[]
): Variable[] {
  const byKey = new Map<string, Variable>();
  for (const variable of baseVariables) {
    const key = variable.key.trim();
    if (!key || variable.enabled === false) {
      continue;
    }
    byKey.set(key, variable);
  }
  for (const variable of livePageVariables) {
    const key = variable.key.trim();
    if (!key || variable.enabled === false) {
      continue;
    }
    byKey.set(key, variable);
  }
  return [...byKey.values()];
}
