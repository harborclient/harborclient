import { useEffect } from 'react';
import type { MenuActionId } from '#/shared/types/app';
import { useSidebarGit } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarGitContext';

/**
 * Menu action ids handled by the git sidebar provider for the active collection.
 */
const GIT_MENU_ACTIONS = new Set<MenuActionId>([
  'git-create-branch',
  'git-delete-branch',
  'git-commit',
  'git-merge',
  'git-fetch',
  'git-pull',
  'git-push'
]);

/**
 * Keeps the native Git menu enabled state in sync and routes git menu shortcuts
 * to the active collection's git actions.
 */
export function GitMenuActionHost(): null {
  const {
    isActiveCollectionGit,
    commitActiveCollection,
    mergeActiveCollection,
    createBranchActiveCollection,
    deleteBranchActiveCollection,
    fetchActiveCollection,
    pullActiveCollection,
    pushActiveCollection
  } = useSidebarGit();

  /**
   * Syncs whether git menu items should be enabled for the active collection.
   */
  useEffect(() => {
    void window.api.setMenuGitCollectionActive(isActiveCollectionGit);
  }, [isActiveCollectionGit]);

  /**
   * Dispatches git menu actions to the active collection helpers.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      if (!GIT_MENU_ACTIONS.has(action)) {
        return;
      }

      switch (action) {
        case 'git-commit':
          commitActiveCollection();
          break;
        case 'git-merge':
          mergeActiveCollection();
          break;
        case 'git-create-branch':
          createBranchActiveCollection();
          break;
        case 'git-delete-branch':
          deleteBranchActiveCollection();
          break;
        case 'git-fetch':
          void fetchActiveCollection();
          break;
        case 'git-pull':
          void pullActiveCollection();
          break;
        case 'git-push':
          void pushActiveCollection();
          break;
      }
    });

    return unsubscribe;
  }, [
    commitActiveCollection,
    createBranchActiveCollection,
    deleteBranchActiveCollection,
    fetchActiveCollection,
    mergeActiveCollection,
    pullActiveCollection,
    pushActiveCollection
  ]);

  return null;
}
