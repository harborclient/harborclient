import type { Collection, Folder } from '@harborclient/core/types';
import {
  buildReorderMenuGroup,
  COPY_TO_CHAT_LABEL,
  type MenuItem,
  type MenuPosition
} from '@harborclient/sdk/components';
import { type JSX, useMemo } from 'react';

import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { buildCopyIdMenuItem } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/copyEntityId';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/SidebarRowActionsMenu';
import { useCollectionActions } from '#/renderer/src/ui/Sidebars/CollectionSidebar/actions/useCollectionActions';

interface Props {
  /**
   * Parent collection identity used by folder actions.
   */
  collection: Pick<Collection, 'id' | 'name'>;

  /**
   * Folder this menu acts on.
   */
  folder: Pick<Folder, 'id' | 'name' | 'uuid' | 'marker'>;

  /**
   * Zero-based index among sibling folders under the same parent.
   */
  folderIndex: number;

  /**
   * Number of sibling folders under the same parent.
   */
  foldersCount: number;

  /**
   * Request ids in this folder's subtree (used by delete confirmation).
   */
  subtreeRequestIds: number[];

  /**
   * Number of descendant folders under this folder.
   */
  descendantFolderCount: number;

  /**
   * Id of the currently open row actions menu, if any.
   */
  openMenuId?: string | null;

  /**
   * Called when this menu opens or closes.
   */
  onOpenChange?: (menuId: string | null) => void;

  /**
   * Cursor position captured when the row context menu opened, for DevTools inspect.
   */
  inspectPoint?: InspectPoint;

  /**
   * When false, hides Move up/down (search, filter, or custom sort is active).
   */
  reorderEnabled?: boolean;

  /**
   * Moves the folder one position up or down among siblings.
   */
  onMove: (direction: 'up' | 'down') => void;

  /**
   * How the menu is presented. Defaults to `row`.
   */
  presentation?: 'row' | 'anchor';

  /**
   * Host viewport coordinates when {@link presentation} is `anchor`.
   */
  anchorPosition?: MenuPosition;

  /**
   * Called when an anchored menu dismisses.
   */
  onDismiss?: () => void;
}

/**
 * Row actions menu for a folder in the collections sidebar.
 */
export function FolderActionsMenu({
  collection,
  folder,
  folderIndex,
  foldersCount,
  subtreeRequestIds,
  descendantFolderCount,
  openMenuId = null,
  onOpenChange,
  inspectPoint,
  reorderEnabled = true,
  onMove,
  presentation = 'row',
  anchorPosition,
  onDismiss
}: Props): JSX.Element {
  const { aiAvailable, copyToChat } = useCopyToChat();
  const pluginContextMenuItems = usePluginContextMenuItems();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const {
    onRunFolder,
    onNewRequestInFolder,
    onNewFolder,
    onNewDocumentInFolder,
    onImportRequest,
    onSaveAllInFolder,
    onRenameFolder,
    onConfigureFolder,
    onDeleteFolder
  } = useCollectionActions();

  const menuId = `folder-${folder.id}`;

  /**
   * Assembles folder row action groups (New/Settings/Copy ID/Copy to chat, Run/Import, Save/Rename/Delete, reorder, plugin items).
   */
  const menuGroups = useMemo((): MenuItem[][] => {
    const newGroup: MenuItem[] = [
      {
        label: 'New',
        submenu: [
          [
            {
              label: 'New Request',
              onSelect: () => void onNewRequestInFolder(collection.id, folder.id)
            },
            {
              label: 'New Folder',
              onSelect: () => onNewFolder(collection.id, folder.id)
            },
            {
              label: 'New Markdown',
              onSelect: () => void onNewDocumentInFolder(collection.id, folder.id)
            }
          ]
        ]
      },
      {
        label: 'Settings',
        onSelect: () => onConfigureFolder(collection.id, folder.id)
      },
      buildCopyIdMenuItem(folder.uuid)
    ];

    if (aiAvailable) {
      newGroup.push({
        label: COPY_TO_CHAT_LABEL,
        onSelect: () => void copyToChat(`@folder.${folder.uuid}`)
      });
    }

    const groups: MenuItem[][] = [
      newGroup,
      [
        {
          label: 'Run',
          onSelect: () => onRunFolder(collection.id, folder.id, collection.name, folder.name)
        },
        {
          label: 'Import Request',
          onSelect: () => void onImportRequest(collection.id, folder.id)
        }
      ],
      [
        {
          label: 'Save all',
          onSelect: () => void onSaveAllInFolder(collection.id, folder.id)
        },
        {
          label: 'Rename',
          onSelect: () => void onRenameFolder(folder.id, collection.id)
        },
        {
          label: 'Delete',
          variant: 'danger',
          onSelect: () =>
            void onDeleteFolder(folder.id, collection.id, subtreeRequestIds, descendantFolderCount)
        }
      ]
    ];

    if (reorderEnabled) {
      for (const group of buildReorderMenuGroup(folderIndex, foldersCount, onMove)) {
        groups.push(group);
      }
    }

    for (const group of buildPluginContextMenuGroups(
      'folder',
      { collectionId: collection.id, folderId: folder.id },
      pluginContextMenuItems
    )) {
      groups.push(group);
    }

    return groups;
  }, [
    aiAvailable,
    collection.id,
    collection.name,
    copyToChat,
    descendantFolderCount,
    developerToolsEnabled,
    folder.id,
    folder.name,
    folder.uuid,
    folderIndex,
    foldersCount,
    inspectPoint,
    menuId,
    onConfigureFolder,
    onDeleteFolder,
    onImportRequest,
    onMove,
    onNewDocumentInFolder,
    onNewFolder,
    onNewRequestInFolder,
    onRenameFolder,
    onRunFolder,
    onSaveAllInFolder,
    pluginContextMenuItems,
    reorderEnabled,
    subtreeRequestIds
  ]);

  /**
   * DevTools inspect actions render after marker groups so Inspect Element stays last.
   */
  const trailingGroups = useMemo(
    () => buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled),
    [developerToolsEnabled, inspectPoint, menuId]
  );

  return (
    <SidebarRowActionsMenu
      menuId={menuId}
      openMenuId={openMenuId}
      onOpenChange={onOpenChange}
      markerTarget={{
        kind: 'folder',
        collectionId: collection.id,
        id: folder.id,
        marker: folder.marker ?? null
      }}
      groups={menuGroups}
      trailingGroups={trailingGroups}
      presentation={presentation}
      anchorPosition={anchorPosition}
      onDismiss={onDismiss}
    />
  );
}
