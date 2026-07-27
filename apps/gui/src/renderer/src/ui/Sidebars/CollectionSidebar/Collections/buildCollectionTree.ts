import { buildFolderTree, type FolderTreeNode } from '@harborclient/core/folderTree';
import type { Folder } from '@harborclient/core/types';

/**
 * Builds the collection sidebar's nested folder hierarchy and optionally
 * applies the active sidebar sort to every sibling group.
 *
 * @param folders - Flat folders belonging to one collection.
 * @param compareFolders - Optional comparison used for each sibling group.
 * @returns Nested folder nodes in display order.
 */
export function buildCollectionTree(
  folders: readonly Folder[],
  compareFolders?: (left: Folder, right: Folder) => number
): FolderTreeNode[] {
  const tree = buildFolderTree(folders);
  if (compareFolders == null) {
    return tree;
  }
  const compare = compareFolders;

  /**
   * Applies the selected display order independently at each nesting level.
   *
   * @param nodes - Sibling nodes to sort recursively.
   */
  function sortSiblings(nodes: FolderTreeNode[]): void {
    nodes.sort((left, right) => compare(left.folder, right.folder));
    for (const node of nodes) {
      sortSiblings(node.children);
    }
  }

  sortSiblings(tree);
  return tree;
}
