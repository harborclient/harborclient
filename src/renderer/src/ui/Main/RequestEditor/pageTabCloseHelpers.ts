import type { Collection, Environment, TeamHub } from '#/shared/types';
import type { PageRef } from '#/renderer/src/store/drafts';
import { resolveTeamHubAdminTabLabel } from '#/renderer/src/ui/Tabs/TeamHub/teamHubDisplayName';

/**
 * Returns whether the active page tab has unsaved collection or environment edits.
 *
 * @param page - Active page reference.
 * @param collectionDirty - Collection settings dirty flag from navigation state.
 * @param environmentDirty - Environment settings dirty flag from navigation state.
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
  if (page.type === 'collection') {
    return collectionDirty;
  }
  if (page.type === 'folder') {
    return folderDirty;
  }
  if (page.type === 'environment') {
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
  switch (page.type) {
    case 'getting-started':
      return 'Getting Started';
    case 'settings':
      return 'Settings';
    case 'plugins':
      return 'Plugins';
    case 'themes':
      return 'Themes';
    case 'cookies':
      return 'Cookies';
    case 'snippets':
      return 'Snippets';
    case 'team-hubs':
      return 'Team Hub';
    case 'team-hub-admin':
      return resolveTeamHubAdminTabLabel(page, teamHubs);
    case 'sharing-keys':
      return 'Sharing Keys';
    case 'hosted-main-view':
      return 'Plugin';
    case 'collection':
      return collections.find((collection) => collection.id === page.id)?.name ?? 'Collection';
    case 'folder':
      return 'Folder';
    case 'environment':
      return environments.find((environment) => environment.id === page.id)?.name ?? 'Environment';
    case 'collection-runner':
      return 'Collection Runner';
    case 'plugin-detail':
    case 'snippet-detail':
    case 'snippet-edit':
    case 'script-editor':
      return page.label;
    default:
      return 'Tab';
  }
}
