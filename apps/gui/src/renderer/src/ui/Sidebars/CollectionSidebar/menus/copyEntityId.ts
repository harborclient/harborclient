import type { MenuItem } from '@harborclient/sdk/components';
import toast from 'react-hot-toast';

/**
 * Copies an entity id to the system clipboard and shows a success toast.
 * Used by sidebar "Copy ID" context-menu actions for CLI/automation workflows.
 *
 * @param id - Portable uuid (or history numeric id as a string) to copy.
 */
export function copyEntityId(id: string): void {
  void navigator.clipboard.writeText(id).then(() => {
    toast.success('Copied to clipboard');
  });
}

/**
 * Builds a "Copy ID" menu item that writes the given id to the clipboard.
 *
 * @param id - Portable uuid (or history numeric id as a string) to copy.
 * @returns A menu item labeled "Copy ID".
 */
export function buildCopyIdMenuItem(id: string): MenuItem {
  return {
    label: 'Copy ID',
    onSelect: () => {
      copyEntityId(id);
    }
  };
}
