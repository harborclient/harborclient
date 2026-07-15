import { useSidebarSectionMenuSync } from '#/renderer/src/hooks/useSidebarSectionMenuSync';

/**
 * Syncs View menu section visibility inside the expansion provider tree.
 */
export function SidebarSectionMenuSync(): null {
  useSidebarSectionMenuSync();
  return null;
}
