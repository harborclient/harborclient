/**
 * Returns whether any collection or folder tree is currently expanded.
 *
 * Used by the Collapse all toolbar control to decide between collapsing trees
 * first versus collapsing sidebar section headers.
 *
 * @param expandedCollectionIds - Collection ids whose request trees are open.
 * @param expandedFolderIds - Folder ids whose request lists are open.
 * @returns True when at least one collection or folder tree is expanded.
 */
export function hasExpandedSidebarTrees(
  expandedCollectionIds: ReadonlySet<number>,
  expandedFolderIds: ReadonlySet<number>
): boolean {
  return expandedCollectionIds.size > 0 || expandedFolderIds.size > 0;
}
