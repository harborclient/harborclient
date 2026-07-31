import type { CollectionProviderKind } from '@harborclient/core/types';

/**
 * Display fields for a collection sidebar storage-location badge.
 */
export interface CollectionStorageBadge {
  /**
   * Short badge text shown next to the collection name.
   */
  label: string;

  /**
   * Tooltip describing where the collection comes from.
   */
  title: string;

  /**
   * When true, the badge is a git branch switcher control.
   * URL-backed collections never use the branch switcher even on git storage.
   */
  isBranchSwitcher: boolean;
}

/**
 * Resolves the sidebar storage badge for a collection.
 *
 * URL-backed collections (`sourceUrl`) always show `http`. Otherwise git
 * connections show the current branch (as a switcher), and other providers
 * show the connection display name.
 *
 * @param sourceUrl - Remote import URL when the collection was imported from HTTP.
 * @param connectionType - Storage provider kind for the collection's connection.
 * @param connectionName - Human-readable connection name.
 * @param gitBranch - Current git branch when the connection is git-backed.
 * @returns Badge fields, or null when nothing meaningful can be shown.
 */
export function resolveCollectionStorageBadge(
  sourceUrl: string | null | undefined,
  connectionType: CollectionProviderKind | undefined,
  connectionName: string | undefined,
  gitBranch: string | null | undefined
): CollectionStorageBadge | null {
  const trimmedSourceUrl = sourceUrl?.trim();
  if (trimmedSourceUrl) {
    return {
      label: 'http',
      title: `Imported from ${trimmedSourceUrl}`,
      isBranchSwitcher: false
    };
  }

  if (connectionType === 'git' && gitBranch != null) {
    return {
      label: gitBranch,
      title: `On branch ${gitBranch}`,
      isBranchSwitcher: true
    };
  }

  if (connectionName == null) {
    return null;
  }

  return {
    label: connectionName,
    title: `Stored in ${connectionName}`,
    isBranchSwitcher: false
  };
}
