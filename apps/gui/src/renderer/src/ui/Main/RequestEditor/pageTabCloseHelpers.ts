import type { Collection, Environment, TeamHub } from '#/shared/types';
import type { PageRef } from '#/renderer/src/store/tabs';
import { getPageRoute, routePageCloseName } from '#/renderer/src/store/routing';
import { resolveTeamHubAdminTabLabel } from '#/renderer/src/ui/Tabs/TeamHub/teamHubDisplayName';

/**
 * Returns whether the active page tab has unsaved collection or environment edits.
 *
 * @param page - Active page reference.
 * @param collectionDirty - Collection settings dirty flag from navigation state.
 * @param environmentDirty - Environment settings dirty flag from navigation state.
 * @param folderDirty - Folder settings dirty flag from navigation state.
 * @returns True when closing the tab should prompt for unsaved changes.
 */
export function isActivePageTabDirty(
  page: PageRef | null,
  collectionDirty: boolean,
  environmentDirty: boolean,
  folderDirty: boolean
): boolean {
  if (!page) {
    return false;
  }
  const dirtyFlag = getPageRoute(page.type).dirtyFlag;
  if (dirtyFlag === 'collection') {
    return collectionDirty;
  }
  if (dirtyFlag === 'folder') {
    return folderDirty;
  }
  if (dirtyFlag === 'environment') {
    return environmentDirty;
  }
  return false;
}

/**
 * Returns a human-readable name for an unsaved page tab close prompt.
 *
 * @param page - Page reference for the tab being closed.
 * @param collections - Current collections for name lookup.
 * @param environments - Current environments for name lookup.
 * @param teamHubs - Current team hubs for admin tab name lookup.
 * @returns Display name for the confirmation dialog.
 */
export function pageTabCloseName(
  page: PageRef,
  collections: Collection[],
  environments: Environment[],
  teamHubs: TeamHub[] = []
): string {
  const collectionName =
    page.type === 'collection'
      ? (collections.find((collection) => collection.id === page.id)?.name ?? undefined)
      : undefined;
  const environmentName =
    page.type === 'environment'
      ? (environments.find((environment) => environment.id === page.id)?.name ?? undefined)
      : undefined;
  const teamHubName =
    page.type === 'team-hub-admin' ? resolveTeamHubAdminTabLabel(page, teamHubs) : undefined;

  return routePageCloseName(page, {
    collectionName,
    environmentName,
    teamHubName
  });
}
