import type { CollectionGitRequestContext } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/CollectionGitRequestProvider';

/**
 * Builds optional git props for a request row from collection git context.
 *
 * @param req - Saved request row data.
 * @param gitContext - Per-collection git context, when the collection is git-backed.
 */
export function requestGitRowProps(
  req: { uuid: string },
  gitContext?: CollectionGitRequestContext
): {
  gitRequestStatus?: CollectionGitRequestContext['statuses'][string];
  onGitAddRequest?: () => void;
  onGitRemoveRequest?: () => void;
} {
  if (gitContext == null) {
    return {};
  }

  return {
    gitRequestStatus: gitContext.statuses[req.uuid],
    onGitAddRequest: () => {
      void gitContext.stageRequest(req.uuid);
    },
    onGitRemoveRequest: () => {
      void gitContext.unstageRequest(req.uuid);
    }
  };
}
