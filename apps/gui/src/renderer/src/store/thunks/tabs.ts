import { createAsyncThunk } from '@reduxjs/toolkit';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  LEGACY_OPEN_TABS_KEY,
  loadTabsFromStorage,
  markTabsHydrated,
  OPEN_TABS_KEY,
  parseOpenTabsFromRaw
} from '#/renderer/src/store/persistence';
import { restoreTabsState } from '#/renderer/src/store/slices/tabsSlice';

/**
 * Loads open request tabs from electron-store (with localStorage migration) and
 * replaces the default startup tab state.
 */
export const hydrateOpenTabs = createAsyncThunk<void, void, ThunkApiConfig>(
  'tabs/hydrateOpenTabs',
  async (_, { dispatch }) => {
    let raw: string | null = null;
    try {
      raw = await window.api.getOpenTabsPayload();
    } catch {
      raw = null;
    }

    const localStorageRaw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(OPEN_TABS_KEY) : null;
    const legacyRaw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_OPEN_TABS_KEY) : null;

    if (raw) {
      const state = parseOpenTabsFromRaw(raw);
      dispatch(restoreTabsState(state));
    } else if (localStorageRaw ?? legacyRaw) {
      const state = loadTabsFromStorage();
      dispatch(restoreTabsState(state));
      const migrated = localStorage.getItem(OPEN_TABS_KEY);
      if (migrated) {
        void window.api.setOpenTabsPayload(migrated);
      }
    }

    markTabsHydrated();
  }
);
