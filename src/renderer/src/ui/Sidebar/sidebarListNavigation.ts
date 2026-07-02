import type { AppDispatch } from '#/renderer/src/store/redux';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';

/** Sidebar section identifier used with `data-sidebar-section`. */
export type SidebarSection = 'collections' | 'environments';

/** Data attribute marking a collections or environments sidebar section. */
export const SIDEBAR_SECTION_ATTR = 'data-sidebar-section';

/** Data attribute on collection name buttons in the sidebar list. */
export const SIDEBAR_COLLECTION_ID_ATTR = 'data-sidebar-collection-id';

/** Data attribute on environment name buttons in the sidebar list. */
export const SIDEBAR_ENVIRONMENT_ID_ATTR = 'data-sidebar-environment-id';

/**
 * Returns a CSS selector for a sidebar section container.
 *
 * @param section - Collections or environments section key.
 * @returns Selector matching the section root element.
 */
export function sidebarSectionSelector(section: SidebarSection): string {
  return `[${SIDEBAR_SECTION_ATTR}="${section}"]`;
}

/**
 * Returns a selector for a collection row focus target in the sidebar.
 *
 * @param collectionId - Collection database id.
 * @returns CSS selector for the collection row button.
 */
export function sidebarCollectionRowSelector(collectionId: number): string {
  return `[${SIDEBAR_COLLECTION_ID_ATTR}="${collectionId}"]`;
}

/**
 * Returns a selector for an environment row focus target in the sidebar.
 *
 * @param environmentId - Environment database id.
 * @returns CSS selector for the environment row button.
 */
export function sidebarEnvironmentRowSelector(environmentId: number): string {
  return `[${SIDEBAR_ENVIRONMENT_ID_ATTR}="${environmentId}"]`;
}

/**
 * Returns which sidebar section currently contains keyboard focus.
 *
 * @returns Section key, or null when focus is outside both list sections.
 */
export function getFocusedSidebarSection(): SidebarSection | null {
  const active = document.activeElement;
  if (active == null) {
    return null;
  }

  if (
    typeof active.closest === 'function' &&
    active.closest(sidebarSectionSelector('collections')) != null
  ) {
    return 'collections';
  }

  if (
    typeof active.closest === 'function' &&
    active.closest(sidebarSectionSelector('environments')) != null
  ) {
    return 'environments';
  }

  return null;
}

/**
 * Lists visible row ids for a sidebar section in DOM order.
 *
 * @param section - Collections or environments section.
 * @returns Ordered numeric ids from row data attributes.
 */
export function listSidebarRowIds(section: SidebarSection): number[] {
  const attr = section === 'collections' ? SIDEBAR_COLLECTION_ID_ATTR : SIDEBAR_ENVIRONMENT_ID_ATTR;
  const container = document.querySelector(sidebarSectionSelector(section));
  if (container == null) {
    return [];
  }

  return Array.from(container.querySelectorAll(`[${attr}]`))
    .map((element) => Number(element.getAttribute(attr)))
    .filter((id) => Number.isFinite(id));
}

/**
 * Reads a numeric row id from the nearest ancestor carrying the given attribute.
 *
 * @param element - Focused element or null.
 * @param attr - Row id data attribute name.
 * @returns Parsed id, or null when not found.
 */
function rowIdFromClosest(element: Element | null, attr: string): number | null {
  if (element == null) {
    return null;
  }

  const row = typeof element.closest === 'function' ? element.closest(`[${attr}]`) : null;
  if (row == null) {
    return null;
  }

  const id = Number(row.getAttribute(attr));
  return Number.isFinite(id) ? id : null;
}

/**
 * Resolves the current collection row index from focus and selection state.
 *
 * @param rowIds - Visible collection row ids in DOM order.
 * @param selectedCollectionId - Currently selected collection from the store.
 * @returns Index into `rowIds`, or -1 when unknown.
 */
export function resolveCurrentCollectionRowIndex(
  rowIds: readonly number[],
  selectedCollectionId: number | null
): number {
  if (rowIds.length === 0) {
    return -1;
  }

  const focusedId =
    rowIdFromClosest(document.activeElement, SIDEBAR_COLLECTION_ID_ATTR) ?? selectedCollectionId;
  if (focusedId == null) {
    return 0;
  }

  const index = rowIds.indexOf(focusedId);
  return index >= 0 ? index : 0;
}

/**
 * Resolves the current environment row index from focus and selection state.
 *
 * @param rowIds - Visible environment row ids in DOM order.
 * @param activeEnvironmentId - Currently active environment from the store.
 * @returns Index into `rowIds`, or -1 when unknown.
 */
export function resolveCurrentEnvironmentRowIndex(
  rowIds: readonly number[],
  activeEnvironmentId: number | null
): number {
  if (rowIds.length === 0) {
    return -1;
  }

  const focusedId =
    rowIdFromClosest(document.activeElement, SIDEBAR_ENVIRONMENT_ID_ATTR) ?? activeEnvironmentId;
  if (focusedId == null) {
    return 0;
  }

  const index = rowIds.indexOf(focusedId);
  return index >= 0 ? index : 0;
}

/**
 * Returns the next or previous index in a circular list.
 *
 * @param currentIndex - Current index, or -1 to start at an end based on direction.
 * @param length - List length.
 * @param direction - `1` for next, `-1` for previous.
 * @returns Wrapped index, or -1 when the list is empty.
 */
export function wrapSidebarRowIndex(
  currentIndex: number,
  length: number,
  direction: 1 | -1
): number {
  if (length === 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction === 1 ? 0 : length - 1;
  }

  return (currentIndex + direction + length) % length;
}

/**
 * Focuses a sidebar row element and scrolls it into view when supported.
 *
 * @param row - Candidate row element from the sidebar list.
 * @returns True when focus was applied.
 */
export function focusSidebarRowElement(row: Element | null): boolean {
  if (row == null || !('focus' in row) || typeof row.focus !== 'function') {
    return false;
  }

  row.focus();
  if ('scrollIntoView' in row && typeof row.scrollIntoView === 'function') {
    row.scrollIntoView({ block: 'nearest' });
  }

  return true;
}

/**
 * Focuses a collection row by id, optionally waiting for mount.
 *
 * @param collectionId - Collection database id.
 * @param waitForMount - When true, defer until after two animation frames.
 */
export function focusSidebarCollectionRowById(collectionId: number, waitForMount = false): void {
  /**
   * Queries the DOM and focuses the matching collection row button.
   */
  const focusRow = (): void => {
    const row = document.querySelector(sidebarCollectionRowSelector(collectionId));
    focusSidebarRowElement(row);
  };

  if (waitForMount) {
    requestAnimationFrame(() => {
      requestAnimationFrame(focusRow);
    });
    return;
  }

  focusRow();
}

/**
 * Focuses an environment row by id, optionally waiting for mount.
 *
 * @param environmentId - Environment database id.
 * @param waitForMount - When true, defer until after two animation frames.
 */
export function focusSidebarEnvironmentRowById(environmentId: number, waitForMount = false): void {
  /**
   * Queries the DOM and focuses the matching environment row button.
   */
  const focusRow = (): void => {
    const row = document.querySelector(sidebarEnvironmentRowSelector(environmentId));
    focusSidebarRowElement(row);
  };

  if (waitForMount) {
    requestAnimationFrame(() => {
      requestAnimationFrame(focusRow);
    });
    return;
  }

  focusRow();
}

interface AdvanceSidebarListItemOptions {
  /** `1` for next item, `-1` for previous. */
  direction: 1 | -1;
  /** Redux dispatch for selection updates. */
  dispatch: AppDispatch;
  /** Selected collection id from the store. */
  selectedCollectionId: number | null;
  /** Active environment id from the store. */
  activeEnvironmentId: number | null;
}

/**
 * Moves keyboard focus to the next or previous top-level sidebar row in the
 * focused section (collections or environments).
 *
 * @param options - Direction, dispatch, and current selection ids.
 * @returns True when navigation ran and focus moved.
 */
export function advanceSidebarListItem(options: AdvanceSidebarListItemOptions): boolean {
  const { direction, dispatch, selectedCollectionId, activeEnvironmentId } = options;
  const section = getFocusedSidebarSection();
  if (section == null) {
    return false;
  }

  const rowIds = listSidebarRowIds(section);
  if (rowIds.length === 0) {
    return false;
  }

  const currentIndex =
    section === 'collections'
      ? resolveCurrentCollectionRowIndex(rowIds, selectedCollectionId)
      : resolveCurrentEnvironmentRowIndex(rowIds, activeEnvironmentId);
  const nextIndex = wrapSidebarRowIndex(currentIndex, rowIds.length, direction);
  if (nextIndex < 0) {
    return false;
  }

  const nextId = rowIds[nextIndex];
  if (nextId == null) {
    return false;
  }

  if (section === 'collections') {
    dispatch(setSelectedCollectionId(nextId));
    focusSidebarCollectionRowById(nextId);
    return true;
  }

  dispatch(setActiveEnvironmentId(nextId));
  focusSidebarEnvironmentRowById(nextId);
  return true;
}
