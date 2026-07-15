import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { ThemeSource } from '#/shared/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeThemePicker, selectThemePicker } from '#/renderer/src/store/slices/modalsSlice';
import { ThemePickerModalBody } from './ThemePickerModalBody';

/**
 * First-run modal that lets the user preview and pick a built-in appearance theme and display size.
 */
export function ThemePickerModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const themePicker = useAppSelector(selectThemePicker);
  const [initialTheme, setInitialTheme] = useState<ThemeSource | null>(null);
  const [initialZoom, setInitialZoom] = useState<number | null>(null);
  const loadingInitialState = useRef(false);

  /**
   * Closes the theme picker modal in Redux state.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeThemePicker());
    setInitialTheme(null);
    setInitialZoom(null);
  }, [dispatch]);

  /**
   * Captures the active theme and zoom when the modal opens so dismiss can revert cleanly.
   */
  useEffect(() => {
    if (
      !themePicker?.open ||
      loadingInitialState.current ||
      initialTheme != null ||
      initialZoom != null
    ) {
      return;
    }

    loadingInitialState.current = true;
    void Promise.all([window.api.getTheme(), window.api.getZoomFactor()]).then(([theme, zoom]) => {
      setInitialTheme(theme);
      setInitialZoom(zoom);
      loadingInitialState.current = false;
    });
  }, [initialTheme, initialZoom, themePicker?.open]);

  if (!themePicker?.open || initialTheme == null || initialZoom == null) {
    return null;
  }

  return (
    <ThemePickerModalBody
      key="theme-picker"
      initialTheme={initialTheme}
      initialZoom={initialZoom}
      onClose={handleClose}
    />
  );
}
