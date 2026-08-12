import { type MenuItem } from '@harborclient/sdk/components';
import { type JSX, useMemo } from 'react';
import type { Collection } from '@harborclient/core/types';

import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/SidebarRowActionsMenu';

interface Props {
  /**
   * Archived collection this menu acts on.
   */
  collection: Pick<Collection, 'id' | 'name' | 'marker'>;

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
   * Restores this collection to the Collections tree after confirmation.
   */
  onRestore: (collection: Pick<Collection, 'id' | 'name'>) => Promise<void>;

  /**
   * Moves this collection to trash after confirmation.
   */
  onDelete: (collection: Pick<Collection, 'id' | 'name'>) => Promise<void>;
}

/**
 * Builds and renders the Archive row actions menu with Restore, Delete, and
 * Set color marker / Clear color marker (appended by {@link SidebarRowActionsMenu}).
 */
export function ActionsMenu({
  collection,
  openMenuId,
  onOpenChange,
  inspectPoint,
  onRestore,
  onDelete
}: Props): JSX.Element {
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const menuId = `archive-collection-${collection.id}`;

  /**
   * Assembles Restore, Delete, and optional DevTools inspect groups.
   */
  const menuGroups = useMemo((): MenuItem[][] => {
    const groups: MenuItem[][] = [
      [
        {
          label: 'Restore',
          onSelect: () => {
            void onRestore(collection);
          }
        }
      ],
      [
        {
          label: 'Delete',
          variant: 'danger' as const,
          onSelect: () => {
            void onDelete(collection);
          }
        }
      ]
    ];

    return groups;
  }, [collection, onDelete, onRestore]);

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
        kind: 'collection',
        id: collection.id,
        marker: collection.marker ?? null
      }}
      groups={menuGroups}
      trailingGroups={trailingGroups}
    />
  );
}
