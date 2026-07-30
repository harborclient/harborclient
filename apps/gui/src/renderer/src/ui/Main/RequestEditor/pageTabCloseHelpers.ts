import type { Collection, Environment, TeamHub, Workspace } from '@harborclient/core/types';
import type { PageRef } from '#/renderer/src/store/tabs';
import { getPageRoute, routePageCloseName } from '#/renderer/src/store/routing';
import { resolveTeamHubAdminTabLabel } from '#/renderer/src/ui/Tabs/TeamHub/teamHubDisplayName';

/**
 * Returns whether the active page tab has unsaved collection, environment,
 * folder, workspace, or browser-settings edits.
 *
 * @param page - Active page reference.
 * @param collectionDirty - Collection settings dirty flag from navigation state.
 * @param environmentDirty - Environment settings dirty flag from navigation state.
 * @param folderDirty - Folder settings dirty flag from navigation state.
 * @param workspaceDirty - Workspace settings dirty flag from navigation state.
 * @param browserSettingsDirty - Whether the linked browser tab has unsaved script edits.
 * @returns True when closing the tab should prompt for unsaved changes.
 */
export function isActivePageTabDirty(
  page: PageRef | null,
  collectionDirty: boolean,
  environmentDirty: boolean,
  folderDirty: boolean,
  workspaceDirty = false,
  browserSettingsDirty = false
): boolean {
  if (!page) {
    return false;
  }
  if (page.type === 'browser-settings') {
    return browserSettingsDirty;
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
  if (dirtyFlag === 'workspace') {
    return workspaceDirty;
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
 * @param workspaces - Current workspaces for name lookup.
 * @returns Display name for the confirmation dialog.
 */
export function pageTabCloseName(
  page: PageRef,
  collections: Collection[],
  environments: Environment[],
  teamHubs: TeamHub[] = [],
  workspaces: Workspace[] = []
): string {
  const collectionName =
    page.type === 'collection'
      ? (collections.find((collection) => collection.id === page.id)?.name ?? undefined)
      : undefined;
  const environmentName =
    page.type === 'environment'
      ? (environments.find((environment) => environment.id === page.id)?.name ?? undefined)
      : undefined;
  const workspaceName =
    page.type === 'workspace'
      ? (workspaces.find((workspace) => workspace.id === page.id)?.name ?? undefined)
      : undefined;
  const teamHubName =
    page.type === 'team-hub-admin' ? resolveTeamHubAdminTabLabel(page, teamHubs) : undefined;

  return routePageCloseName(page, {
    collectionName,
    environmentName,
    workspaceName,
    teamHubName
  });
}
