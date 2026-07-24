import { createAsyncThunk } from '@reduxjs/toolkit';
import { clearSession } from '#/renderer/src/store/slices/themeDesignerSlice';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';

/**
 * Ends the Theme Designer session, restoring the real active theme.
 *
 * The Designer applies its draft palette globally so edits can be previewed
 * across the whole app, including while other tabs are focused. That preview
 * must persist across tab switches (the Designer component unmounting), so the
 * revert to the real active theme is tied to session teardown here rather than
 * to component unmount. Called when the user leaves the Designer section or
 * closes the Themes tab without saving.
 */
export const discardThemeDesignerSession = createAsyncThunk<void, void, ThunkApiConfig>(
  'themeDesigner/discardSession',
  async (_, { dispatch, getState }) => {
    const { initialized, activeThemeAtOpen } = getState().themeDesigner;
    dispatch(clearSession());
    if (initialized) {
      await applyThemePreference(activeThemeAtOpen);
    }
  }
);
