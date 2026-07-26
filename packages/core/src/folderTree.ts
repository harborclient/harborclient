import type { Folder } from './types';

/**
 * A folder plus its nested child folders for sidebar and runner walks.
 */
export interface FolderTreeNode {
  /**
   * Folder row at this tree node.
   */
  folder: Folder;

  /**
   * Immediate child folders, ordered by sort_order then name.
   */
  children: FolderTreeNode[];
}

/**
 * Compares sibling folders for stable sidebar and run ordering.
 *
 * @param left - First folder.
 * @param right - Second folder.
 * @returns Negative when left sorts before right.
 */
function compareSiblingFolders(left: Folder, right: Folder): number {
  return left.sort_order - right.sort_order || left.name.localeCompare(right.name);
}

/**
 * Builds a nested folder tree from a flat folder list.
 *
 * Orphaned folders whose parent is missing from the list are treated as collection-root
 * children so the tree remains usable after partial loads.
 *
 * @param folders - Flat folders for one or more collections.
 * @returns Root-level tree nodes (parent_folder_id null or missing parent), sorted.
 */
export function buildFolderTree(folders: readonly Folder[]): FolderTreeNode[] {
  const byId = new Map<number, FolderTreeNode>();
  for (const folder of folders) {
    byId.set(folder.id, { folder, children: [] });
  }

  const roots: FolderTreeNode[] = [];
  for (const folder of folders) {
    const node = byId.get(folder.id);
    if (!node) {
      continue;
    }
    const parentId = folder.parent_folder_id;
    if (parentId != null && byId.has(parentId)) {
      byId.get(parentId)?.children.push(node);
      continue;
    }
    roots.push(node);
  }

  /**
   * Sorts each node's children recursively by sibling order.
   *
   * @param nodes - Sibling nodes to sort in place.
   */
  function sortRecursive(nodes: FolderTreeNode[]): void {
    nodes.sort((left, right) => compareSiblingFolders(left.folder, right.folder));
    for (const node of nodes) {
      sortRecursive(node.children);
    }
  }

  sortRecursive(roots);
  return roots;
}

/**
 * Returns ancestor folders from the immediate parent up to the collection root.
 *
 * @param folderId - Folder whose ancestors are requested.
 * @param folders - Flat folder list containing the target.
 * @returns Ancestors ordered nearest-parent first; empty when the folder is at root or missing.
 */
export function getFolderAncestors(folderId: number, folders: readonly Folder[]): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const ancestors: Folder[] = [];
  let current = byId.get(folderId);
  const seen = new Set<number>();

  while (current?.parent_folder_id != null) {
    if (seen.has(current.parent_folder_id)) {
      break;
    }
    seen.add(current.parent_folder_id);
    const parent = byId.get(current.parent_folder_id);
    if (!parent) {
      break;
    }
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
}

/**
 * Builds a display path of folder names from collection root to the target folder.
 *
 * @param folderId - Folder to resolve.
 * @param folders - Flat folder list containing the target.
 * @param separator - Segment separator; defaults to `" / "`.
 * @returns Path string, or empty string when the folder is missing.
 */
export function getFolderPath(
  folderId: number,
  folders: readonly Folder[],
  separator = ' / '
): string {
  const folder = folders.find((candidate) => candidate.id === folderId);
  if (!folder) {
    return '';
  }
  const ancestors = getFolderAncestors(folderId, folders).reverse();
  return [...ancestors.map((ancestor) => ancestor.name), folder.name].join(separator);
}

/**
 * Walks a folder tree depth-first (pre-order): parent before its descendants.
 *
 * @param tree - Root nodes from {@link buildFolderTree}.
 * @param visitor - Called once per folder in walk order.
 */
export function walkFoldersDepthFirst(
  tree: readonly FolderTreeNode[],
  visitor: (folder: Folder, depth: number) => void
): void {
  /**
   * Recurses into a sibling list.
   *
   * @param nodes - Nodes at the current depth.
   * @param depth - Zero-based depth from the tree roots.
   */
  function walk(nodes: readonly FolderTreeNode[], depth: number): void {
    for (const node of nodes) {
      visitor(node.folder, depth);
      walk(node.children, depth + 1);
    }
  }

  walk(tree, 0);
}

/**
 * Returns whether moving `folderId` under `newParentId` would create a cycle.
 *
 * @param folderId - Folder being moved.
 * @param newParentId - Proposed parent folder id, or null for collection root.
 * @param folders - Flat folder list for the collection.
 * @returns True when the move would nest the folder under itself or a descendant.
 */
export function wouldCreateFolderCycle(
  folderId: number,
  newParentId: number | null,
  folders: readonly Folder[]
): boolean {
  if (newParentId == null) {
    return false;
  }
  if (newParentId === folderId) {
    return true;
  }

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  let current = byId.get(newParentId);
  const seen = new Set<number>();

  while (current) {
    if (current.id === folderId) {
      return true;
    }
    if (current.parent_folder_id == null || seen.has(current.parent_folder_id)) {
      break;
    }
    seen.add(current.parent_folder_id);
    current = byId.get(current.parent_folder_id);
  }

  return false;
}

/**
 * Returns folders that are descendants of `folderId` (not including itself), depth-first.
 *
 * @param folderId - Ancestor folder id.
 * @param folders - Flat folder list for the collection.
 * @returns Descendant folders in depth-first order.
 */
export function getFolderDescendants(folderId: number, folders: readonly Folder[]): Folder[] {
  const tree = buildFolderTree(folders);
  const descendants: Folder[] = [];

  /**
   * Finds the subtree rooted at folderId and collects descendants.
   *
   * @param nodes - Nodes to search.
   * @returns True when the target subtree was found.
   */
  function findAndCollect(nodes: readonly FolderTreeNode[]): boolean {
    for (const node of nodes) {
      if (node.folder.id === folderId) {
        walkFoldersDepthFirst(node.children, (folder) => {
          descendants.push(folder);
        });
        return true;
      }
      if (findAndCollect(node.children)) {
        return true;
      }
    }
    return false;
  }

  findAndCollect(tree);
  return descendants;
}
