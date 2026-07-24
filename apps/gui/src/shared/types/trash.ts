/**
 * Sidebar entity kinds that can be moved to trash.
 */
export type TrashEntityType =
  | 'collection'
  | 'folder'
  | 'request'
  | 'document'
  | 'runResult'
  | 'history'
  | 'environment'
  | 'tabGroup';

/**
 * A snapshot row stored in the registry trash table.
 */
export interface TrashItem {
  /**
   * Trash table primary key.
   */
  id: number;

  /**
   * Original sidebar entity kind.
   */
  entityType: TrashEntityType;

  /**
   * Display label shown in the Trash section row.
   */
  label: string;

  /**
   * Storage connection id for provider-backed entities; null for registry-only rows.
   */
  connectionId: string | null;

  /**
   * Original ids and parent references needed to restore the entity.
   */
  originalIds: Record<string, unknown>;

  /**
   * Serialized entity snapshot used to recreate the item on restore.
   */
  payload: unknown;

  /**
   * ISO timestamp when the item was moved to trash.
   */
  deletedAt: string;
}

/**
 * Input for inserting a trash snapshot row.
 */
export interface InsertTrashItemInput {
  /**
   * Original sidebar entity kind.
   */
  entityType: TrashEntityType;

  /**
   * Display label shown in the Trash section row.
   */
  label: string;

  /**
   * Storage connection id for provider-backed entities; null for registry-only rows.
   */
  connectionId?: string | null;

  /**
   * Original ids and parent references needed to restore the entity.
   */
  originalIds: Record<string, unknown>;

  /**
   * Serialized entity snapshot used to recreate the item on restore.
   */
  payload: unknown;
}
