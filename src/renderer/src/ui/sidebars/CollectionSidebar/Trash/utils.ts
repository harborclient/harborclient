import type { TrashEntityType } from '#/shared/types/trash';

/**
 * Returns a short entity-kind label for a trash row subtitle.
 *
 * @param entityType - Trash snapshot entity kind.
 */
export function trashEntityTypeLabel(entityType: TrashEntityType): string {
  switch (entityType) {
    case 'collection':
      return 'Collection';
    case 'folder':
      return 'Folder';
    case 'request':
      return 'Request';
    case 'document':
      return 'Document';
    case 'runResult':
      return 'Run';
    case 'history':
      return 'History';
    case 'environment':
      return 'Environment';
    case 'tabGroup':
      return 'Tab group';
    default:
      return 'Item';
  }
}

/**
 * Formats a trash row deleted timestamp for sidebar metadata.
 *
 * @param deletedAt - ISO timestamp from the trash table.
 */
export function formatTrashDeletedAt(deletedAt: string): string {
  const parsed = Date.parse(deletedAt);
  if (Number.isNaN(parsed)) {
    return deletedAt;
  }

  return new Date(parsed).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}
