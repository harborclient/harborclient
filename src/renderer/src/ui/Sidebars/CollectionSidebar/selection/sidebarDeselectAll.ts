/**
 * Inputs for deciding whether the collections sidebar has anything to deselect.
 */
export interface SidebarDeselectableSelectionInput {
  /**
   * Collection id currently highlighted in the sidebar, if any.
   */
  selectedCollectionId: number | null;

  /**
   * Folder id currently highlighted in the sidebar, if any.
   */
  selectedFolderId: number | null;

  /**
   * Environment id currently active for sending requests, if any.
   */
  activeEnvironmentId: number | null;

  /**
   * Multi-select counts reported by sidebar sections keyed by registration id.
   */
  sectionSelectionCounts: Readonly<Record<string, number>>;

  /**
   * Number of saved request tabs currently open.
   */
  openRequestTabCount: number;

  /**
   * Number of markdown document tabs currently open.
   */
  openMarkdownTabCount: number;
}

/**
 * Returns whether the collections sidebar has any selection state worth clearing.
 *
 * @param input - Current Redux and section-reported selection state.
 * @returns True when Edit → Deselect all should be enabled.
 */
export function sidebarHasDeselectableSelection(input: SidebarDeselectableSelectionInput): boolean {
  const {
    selectedCollectionId,
    selectedFolderId,
    activeEnvironmentId,
    sectionSelectionCounts,
    openRequestTabCount,
    openMarkdownTabCount
  } = input;

  if (selectedCollectionId != null) {
    return true;
  }

  if (selectedFolderId != null) {
    return true;
  }

  if (activeEnvironmentId != null) {
    return true;
  }

  if (openRequestTabCount > 0 || openMarkdownTabCount > 0) {
    return true;
  }

  return Object.values(sectionSelectionCounts).some((count) => count > 0);
}
