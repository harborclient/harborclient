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
