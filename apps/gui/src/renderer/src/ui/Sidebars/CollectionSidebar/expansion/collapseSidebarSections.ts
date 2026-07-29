import type { SidebarSectionKey } from '@harborclient/core/types';

const BUILTIN_SECTION_KEYS: readonly SidebarSectionKey[] = [
  'collections',
  'environments',
  'runResults',
  'history',
  'workspaces',
  'workflows',
  'archive',
  'trash'
];

/**
 * Returns the built-in section keys present in `keys` that should be collapsed.
 *
 * @param keys - Section keys currently visible in the sidebar body.
 * @returns Built-in keys to set collapsed.
 */
export function builtInSectionsToCollapse(keys: readonly string[]): SidebarSectionKey[] {
  const keySet = new Set(keys);
  return BUILTIN_SECTION_KEYS.filter((key) => keySet.has(key));
}

/**
 * Returns the next plugin-section expansion map after collapsing entries whose ids
 * appear in `keys`. Unrelated plugin sections keep their previous state.
 *
 * @param current - Current plugin section expanded map.
 * @param keys - Section keys currently visible in the sidebar body.
 * @param pluginSectionIds - Registered plugin sidebar section ids.
 * @returns Next map, or the same reference when nothing changes.
 */
export function collapsePluginSectionsInMap(
  current: Record<string, boolean>,
  keys: readonly string[],
  pluginSectionIds: readonly string[]
): Record<string, boolean> {
  const keySet = new Set(keys);
  const next: Record<string, boolean> = { ...current };
  let changed = false;

  for (const id of pluginSectionIds) {
    if (keySet.has(id) && next[id] !== false) {
      next[id] = false;
      changed = true;
    }
  }

  return changed ? next : current;
}
