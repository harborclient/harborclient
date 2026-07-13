import type { CreateTabGroupInput, TabGroup, TabGroupRequest } from '#/shared/types/tabGroup';

/**
 * IPC surface for local tab group persistence.
 */
export interface ApiTabGroups {
  /**
   * Lists all tab groups from the local registry.
   */
  listTabGroups: () => Promise<TabGroup[]>;

  /**
   * Creates a tab group and returns the refreshed list.
   */
  createTabGroup: (input: CreateTabGroupInput) => Promise<TabGroup[]>;

  /**
   * Replaces tab group members and returns the refreshed list.
   */
  updateTabGroup: (id: number, requests: TabGroupRequest[]) => Promise<TabGroup[]>;

  /**
   * Renames a tab group and returns the refreshed list.
   */
  renameTabGroup: (id: number, name: string) => Promise<TabGroup[]>;

  /**
   * Clones a tab group under a new name and returns the refreshed list.
   */
  cloneTabGroup: (id: number, name: string) => Promise<TabGroup[]>;

  /**
   * Deletes a tab group and returns the refreshed list.
   */
  deleteTabGroup: (id: number) => Promise<TabGroup[]>;

  /**
   * Persists a new sidebar order for tab groups and returns the refreshed list.
   */
  reorderTabGroups: (orderedTabGroupIds: number[]) => Promise<TabGroup[]>;

  /**
   * Updates a tab group sidebar color and returns the refreshed list.
   */
  setTabGroupColor: (id: number, color: string | null) => Promise<TabGroup[]>;

  /**
   * Imports a tab group from a JSON file via a native open dialog.
   */
  importTabGroup: () => Promise<TabGroup[] | null>;
}
