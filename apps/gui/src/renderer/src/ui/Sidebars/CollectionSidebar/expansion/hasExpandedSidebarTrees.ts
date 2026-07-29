import type { SidebarMode } from '@harborclient/core/types';

/**
 * Returns whether any collection, folder, or environment tree is currently expanded.
 *
 * Used by the Collapse all toolbar control to decide between collapsing trees
 * first versus collapsing sidebar section headers.
 *
 * @param expandedCollectionIds - Collection ids whose request trees are open.
 * @param expandedFolderIds - Folder ids whose request lists are open.
 * @param expandedEnvironmentIds - Environment ids whose child environments are open.
 * @returns True when at least one collection, folder, or environment tree is expanded.
 */
export function hasExpandedSidebarTrees(
  expandedCollectionIds: ReadonlySet<number>,
  expandedFolderIds: ReadonlySet<number>,
  expandedEnvironmentIds: ReadonlySet<number> = new Set()
): boolean {
  return (
    expandedCollectionIds.size > 0 || expandedFolderIds.size > 0 || expandedEnvironmentIds.size > 0
  );
}

/**
 * Returns whether the active rail mode currently has expandable trees that the
 * collapse-all control should clear before collapsing section headers.
 *
 * Collections mode checks collection and folder trees; environments mode checks
 * environment trees; other modes have no tree step.
 *
 * @param mode - Active activity-rail sidebar mode.
 * @param expandedCollectionIds - Collection ids whose request trees are open.
 * @param expandedFolderIds - Folder ids whose request lists are open.
 * @param expandedEnvironmentIds - Environment ids whose child environments are open.
 * @returns True when the active mode has at least one relevant expanded tree.
 */
export function hasExpandedSidebarTreesForMode(
  mode: SidebarMode,
  expandedCollectionIds: ReadonlySet<number>,
  expandedFolderIds: ReadonlySet<number>,
  expandedEnvironmentIds: ReadonlySet<number> = new Set()
): boolean {
  if (mode === 'collections') {
    return expandedCollectionIds.size > 0 || expandedFolderIds.size > 0;
  }

  if (mode === 'environments') {
    return expandedEnvironmentIds.size > 0;
  }

  return false;
}
