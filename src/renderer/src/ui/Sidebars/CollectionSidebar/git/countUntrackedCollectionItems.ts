import type { GitRequestFileStatus } from '#/shared/types';

/**
 * Counts request and markdown document items in a collection that are untracked
 * in git, used to enable or disable the collection Git "Add all" menu action.
 *
 * @param requests - Requests belonging to the collection (uuid required).
 * @param documents - Documents belonging to the collection (uuid required).
 * @param itemGitStatusByUuid - Per-item git status keyed by item uuid.
 * @returns Number of untracked items in the collection.
 */
export function countUntrackedCollectionItems(
  requests: Array<{ uuid: string }>,
  documents: Array<{ uuid: string }>,
  itemGitStatusByUuid: Record<string, GitRequestFileStatus>
): number {
  let count = 0;

  for (const request of requests) {
    if (itemGitStatusByUuid[request.uuid]?.isUntracked === true) {
      count += 1;
    }
  }

  for (const document of documents) {
    if (itemGitStatusByUuid[document.uuid]?.isUntracked === true) {
      count += 1;
    }
  }

  return count;
}
