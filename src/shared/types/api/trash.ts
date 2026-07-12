import type { TrashEntityType, TrashItem } from '#/shared/types/trash';

/**
 * IPC methods for sidebar trash persistence and restore flows.
 */
export interface ApiTrash {
  /**
   * Lists trash snapshot rows ordered newest-first.
   */
  listTrashItems: () => Promise<TrashItem[]>;

  /**
   * Recreates an entity from its trash snapshot and removes the trash row.
   *
   * @param id - Trash row id.
   */
  restoreTrashItem: (id: number) => Promise<TrashEntityType>;

  /**
   * Permanently deletes one trash snapshot row.
   *
   * @param id - Trash row id.
   */
  permanentlyDeleteTrashItem: (id: number) => Promise<void>;

  /**
   * Permanently deletes every trash snapshot row.
   */
  emptyTrash: () => Promise<void>;
}
