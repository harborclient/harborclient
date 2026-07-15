import type { Collection, CollectionProviderKind } from '#/shared/types';
import { buildReorderMenuGroup, type MenuItem } from '@harborclient/sdk/components';
import { type JSX, useMemo } from 'react';

import { useConfirm, type ConfirmFn } from '#/renderer/src/hooks/useConfirm';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/SidebarRowActionsMenu';
import { useCollectionActions } from '#/renderer/src/ui/Sidebars/CollectionSidebar/actions/useCollectionActions';
import { useSidebarGit } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/sidebarGitContext';

interface Props {
  /**
   * Collection identity and display fields used by menu actions.
   */
  collection: Pick<Collection, 'id' | 'name' | 'uuid' | 'color'>;

  /**
   * Zero-based index of this collection among sortable sidebar collections.
   */
  collectionIndex: number;

  /**
   * Total number of collections, used to enable/disable reorder actions.
   */
  collectionsCount: number;

  /**
   * Id of the currently open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when this menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

  /**
   * Cursor position captured when the row context menu opened, for DevTools inspect.
   */
  inspectPoint: InspectPoint | undefined;

  /**
   * Storage provider kind for this collection's connection.
   */
  connectionType: CollectionProviderKind | undefined;

  /**
   * Human-readable connection name used by git branch actions.
   */
  connectionName: string | undefined;

  /**
   * Resolved connection id for this collection (explicit or primary).
   */
  collectionConnectionId: string;

  /**
   * Whether "Share access" is available for this collection's provider.
   */
  canShare: boolean;

  /**
   * Moves the collection one position up or down in the sidebar.
   */
  onMove: (direction: 'up' | 'down') => void;

  /**
   * Whether the collection currently has a selection that "Deselect all" can clear.
   */
  hasDeselectableSelection: boolean;

  /**
   * Clears request/folder/collection selection scoped to this collection.
   */
  onDeselectAll: () => void;
}

/**
 * Confirms deletion of a collection, optionally offering to delete a git repo directory.
 *
 * @param confirm - Confirmation dialog opener from {@link useConfirm}.
 * @param collection - Collection being deleted.
 * @param connectionType - Provider kind; git collections get a repo-directory checkbox.
 * @param onDeleteCollection - Performs the delete after confirmation.
 */
async function confirmAndDeleteCollection(
  confirm: ConfirmFn,
  collection: Pick<Collection, 'id' | 'name'>,
  connectionType: CollectionProviderKind | undefined,
  onDeleteCollection: (id: number, options?: { deleteRepoDirectory?: boolean }) => Promise<void>
): Promise<void> {
  const confirmOptions = {
    title: 'Delete collection',
    message: `Delete collection "${collection.name}"?`,
    confirmLabel: 'Delete',
    variant: 'danger' as const,
    reconfirm: true
  };
  const result =
    connectionType === 'git'
      ? await confirm({
          ...confirmOptions,
          checkboxLabel: 'Also delete repo directory'
        })
      : await confirm(confirmOptions);
  const confirmed = typeof result === 'boolean' ? result : result.confirmed;
  const deleteRepoDirectory = typeof result === 'boolean' ? false : result.checkboxChecked;
  if (confirmed) {
    void onDeleteCollection(collection.id, { deleteRepoDirectory });
  }
}

/**
 * Row actions menu for a collection in the sidebar, including create, git,
 * reorder, import/export, share, and delete actions.
 */
export function ActionsMenu({
  collection,
  collectionIndex,
  collectionsCount,
  openMenuId,
  onOpenChange,
  inspectPoint,
  connectionType,
  connectionName,
  collectionConnectionId,
  canShare,
  onMove,
  hasDeselectableSelection,
  onDeselectAll
}: Props): JSX.Element {
  const confirm = useConfirm();
  const { aiAvailable, copyToChat } = useCopyToChat();
  const pluginContextMenuItems = usePluginContextMenuItems();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const {
    onConfigureCollection,
    onRunCollection,
    onDeleteCollection,
    onExportCollection,
    onDuplicateCollection,
    onShareCollection,
    onSaveAllInCollection,
    onNewFolder,
    onNewRequestInCollection,
    onImportRequest,
    onNewDocumentInCollection
  } = useCollectionActions();
  const {
    openSourceControl: onOpenSourceControl,
    openCreateBranch: onOpenCreateBranch,
    openMergeBranch: onOpenMergeBranch
  } = useSidebarGit();

  const menuId = `collection-${collection.id}`;

  /**
   * Assembles collection row action groups from named sections so the
   * menu structure stays readable and order stays explicit.
   */
  const menuGroups = useMemo((): MenuItem[][] => {
    const groups: MenuItem[][] = [];

    const createGroup: MenuItem[] = [
      {
        label: 'New',
        submenu: [
          [
            {
              label: 'New Request',
              onSelect: () => void onNewRequestInCollection(collection.id)
            },
            {
              label: 'New Folder',
              onSelect: () => void onNewFolder(collection.id)
            },
            {
              label: 'New Markdown',
              onSelect: () => void onNewDocumentInCollection(collection.id)
            }
          ]
        ]
      }
    ];

    if (connectionType === 'git' && connectionName != null) {
      createGroup.push({
        label: 'Git',
        submenu: [
          [
            {
              label: 'Commit',
              onSelect: () => onOpenSourceControl()
            },
            {
              label: 'Branches',
              onSelect: () =>
                onOpenCreateBranch(collectionConnectionId, connectionName, collection.uuid)
            },
            {
              label: 'Merge',
              onSelect: () =>
                onOpenMergeBranch(collectionConnectionId, connectionName, collection.uuid)
            }
          ]
        ]
      });
    }

    groups.push(createGroup);
    groups.push([
      {
        label: 'Run',
        onSelect: () => onRunCollection(collection.id, collection.name)
      }
    ]);

    if (aiAvailable) {
      groups.push([
        {
          label: 'Copy to chat',
          onSelect: () => void copyToChat(`@collection.${collection.uuid}`)
        }
      ]);
    }

    const reorderGroups = buildReorderMenuGroup(collectionIndex, collectionsCount, onMove);
    for (const group of reorderGroups) {
      groups.push(group);
    }

    groups.push([
      {
        label: 'Settings',
        onSelect: () => onConfigureCollection(collection.id)
      },
      {
        label: 'Duplicate',
        onSelect: () => void onDuplicateCollection(collection.id)
      }
    ]);
    groups.push([
      {
        label: 'Import',
        onSelect: () => void onImportRequest(collection.id)
      },
      {
        label: 'Export',
        onSelect: () => void onExportCollection(collection.id)
      },
      {
        label: 'Save all',
        onSelect: () => void onSaveAllInCollection(collection.id)
      }
    ]);

    if (canShare) {
      groups.push([
        {
          label: 'Share access',
          onSelect: () => onShareCollection(collection.id, collection.name)
        }
      ]);
    }

    const pluginGroups = buildPluginContextMenuGroups(
      'collection',
      { collectionId: collection.id },
      pluginContextMenuItems
    );
    for (const group of pluginGroups) {
      groups.push(group);
    }

    const dangerGroup: MenuItem[] = [];
    if (hasDeselectableSelection) {
      dangerGroup.push({
        label: 'Deselect all',
        onSelect: () => onDeselectAll()
      });
    }
    dangerGroup.push({
      label: 'Delete',
      variant: 'danger' as const,
      onSelect: () => {
        void confirmAndDeleteCollection(confirm, collection, connectionType, onDeleteCollection);
      }
    });
    groups.push(dangerGroup);

    const inspectGroups = buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled);
    for (const group of inspectGroups) {
      groups.push(group);
    }

    return groups;
  }, [
    aiAvailable,
    canShare,
    collection,
    collectionConnectionId,
    collectionIndex,
    collectionsCount,
    confirm,
    connectionName,
    connectionType,
    copyToChat,
    developerToolsEnabled,
    hasDeselectableSelection,
    inspectPoint,
    menuId,
    onConfigureCollection,
    onDeleteCollection,
    onDeselectAll,
    onDuplicateCollection,
    onExportCollection,
    onImportRequest,
    onMove,
    onNewDocumentInCollection,
    onNewFolder,
    onNewRequestInCollection,
    onOpenCreateBranch,
    onOpenMergeBranch,
    onOpenSourceControl,
    onRunCollection,
    onSaveAllInCollection,
    onShareCollection,
    pluginContextMenuItems
  ]);

  return (
    <SidebarRowActionsMenu
      menuId={menuId}
      openMenuId={openMenuId}
      onOpenChange={onOpenChange}
      colorTarget={{
        kind: 'collection',
        id: collection.id,
        color: collection.color ?? null
      }}
      groups={menuGroups}
    />
  );
}
