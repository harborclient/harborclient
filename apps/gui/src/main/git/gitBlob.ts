import * as git from 'isomorphic-git';
import fs from 'fs';

/**
 * Walker tree descriptor accepted by isomorphic-git's `walk` API.
 */
type WalkTree = NonNullable<Parameters<typeof git.walk>[0]['trees']>[number];

/**
 * Reads raw blob bytes for one repository-relative path from a single git tree.
 *
 * Walks HEAD, the index (STAGE), or a commit tree and returns blob content when
 * the path exists and points at a blob object.
 *
 * @param repoPath - Absolute repository root.
 * @param tree - Walker tree descriptor, e.g. `git.TREE({ ref: 'HEAD' })` or `git.STAGE()`.
 * @param filepath - Repository-relative blob path.
 * @returns Blob bytes, or null when the path is missing, not a blob, or unreadable.
 */
export async function readBlobBytesFromTree(
  repoPath: string,
  tree: WalkTree,
  filepath: string
): Promise<Uint8Array | null> {
  let content: Uint8Array | null = null;

  try {
    await git.walk({
      fs,
      dir: repoPath,
      trees: [tree],
      /**
       * Captures blob bytes when the walked path matches the target file.
       *
       * @param path - Repository-relative path from the walker.
       * @param trees - Tuple of tree entries for the requested tree source.
       */
      map: async (path, [entry]) => {
        if (path !== filepath || entry == null) {
          return;
        }
        const type = await entry.type();
        if (type === 'blob') {
          const blob = await entry.content();
          if (blob instanceof Uint8Array) {
            content = blob;
          }
        }
      }
    });
  } catch {
    return null;
  }

  return content;
}
