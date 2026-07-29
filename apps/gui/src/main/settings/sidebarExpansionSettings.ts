import Store from 'electron-store';
import {
  defaultSidebarExpansion,
  normalizeSidebarExpansion
} from '@harborclient/core/sidebarExpansion';
import type { SidebarExpansionState } from '@harborclient/core/types';

const STORE_KEY = 'sidebarExpansion';

let store: Store<{ sidebarExpansion: SidebarExpansionState }> | null = null;

/**
 * Returns the lazy electron-store instance for sidebar expansion preferences.
 */
function getStore(): Store<{ sidebarExpansion: SidebarExpansionState }> {
  if (!store) {
    store = new Store<{ sidebarExpansion: SidebarExpansionState }>({
      name: 'settings',
      defaults: {
        sidebarExpansion: defaultSidebarExpansion()
      }
    });
  }
  return store;
}

/**
 * Returns persisted sidebar expansion state.
 *
 * Rewrites legacy `tabGroups` keys onto `workspaces` when present so the
 * on-disk electron-store blob stays current after upgrade.
 */
export function getSidebarExpansion(): SidebarExpansionState {
  const stored = getStore().get(STORE_KEY, defaultSidebarExpansion());
  const normalized = normalizeSidebarExpansion(stored);
  const raw =
    stored && typeof stored === 'object'
      ? (stored as Partial<SidebarExpansionState> & {
          sections?: Record<string, unknown>;
          sectionVisibility?: Record<string, unknown>;
          sectionSort?: Record<string, unknown>;
        })
      : null;
  const hasLegacy =
    raw != null &&
    ((raw.sections != null &&
      Object.prototype.hasOwnProperty.call(raw.sections, 'tabGroups') &&
      !Object.prototype.hasOwnProperty.call(raw.sections, 'workspaces')) ||
      (raw.sectionVisibility != null &&
        !Object.prototype.hasOwnProperty.call(raw, 'activeSidebarMode')) ||
      (raw.sectionVisibility != null &&
        Object.prototype.hasOwnProperty.call(raw.sectionVisibility, 'tabGroups') &&
        !Object.prototype.hasOwnProperty.call(raw.sectionVisibility, 'workspaces')) ||
      (raw.sectionSort != null &&
        Object.prototype.hasOwnProperty.call(raw.sectionSort, 'tabGroups') &&
        !Object.prototype.hasOwnProperty.call(raw.sectionSort, 'workspaces')));
  if (hasLegacy) {
    getStore().set(STORE_KEY, normalized);
  }
  return normalized;
}

/**
 * Persists sidebar expansion state.
 *
 * @param state - Expansion snapshot to store.
 */
export function setSidebarExpansion(state: SidebarExpansionState): void {
  getStore().set(STORE_KEY, normalizeSidebarExpansion(state));
}
