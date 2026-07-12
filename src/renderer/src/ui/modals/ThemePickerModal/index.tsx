import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { BUILTIN_THEME_OPTIONS } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';
import {
  ZOOM_PRESET_OPTIONS,
  zoomFactorToPreset,
  zoomPresetToFactor,
  type ZoomPreset
} from '#/shared/zoomPresets';
import { previewThemePreference, applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeThemePicker, selectThemePicker } from '#/renderer/src/store/slices/modalsSlice';
import { ThemePreviewCard } from '#/renderer/src/ui/modals/ThemePickerModal/ThemePreviewCard';
import type { BuiltinThemeSource } from '#/renderer/src/ui/modals/ThemePickerModal/previewPalettes';
import { Button, Modal, ModalFooter, SegmentedTabs } from '@harborclient/sdk/components';

const RADIO_GROUP_NAME = 'theme-picker-selection';

interface ModalBodyProps {
  /** Theme active when the modal opened; restored on dismiss without save. */
  initialTheme: ThemeSource;
  /** Zoom factor active when the modal opened; restored on dismiss without save. */
  initialZoom: number;
  /** Dismisses the modal and reverts to the initial theme and zoom. */
  onClose: () => void;
}

/**
 * Renders theme cards, display size presets, live previews, and save/dismiss actions.
 */
function ThemePickerModalBody({ initialTheme, initialZoom, onClose }: ModalBodyProps): JSX.Element {
  const [selectedTheme, setSelectedTheme] = useState<BuiltinThemeSource>('system');
  const [selectedPreset, setSelectedPreset] = useState<ZoomPreset>(() =>
    zoomFactorToPreset(initialZoom)
  );
  const [saving, setSaving] = useState(false);

  /**
   * Applies the selected theme to the app behind the modal for live preview.
   */
  const previewTheme = useCallback((theme: BuiltinThemeSource): void => {
    void previewThemePreference(theme);
  }, []);

  /**
   * Applies the selected display size preset to the app behind the modal for live preview.
   */
  const previewZoom = useCallback((preset: ZoomPreset): void => {
    void window.api.previewZoomFactor(zoomPresetToFactor(preset));
  }, []);

  /**
   * Updates the selected card and previews the theme on the live app.
   */
  const handleSelect = useCallback(
    (theme: BuiltinThemeSource): void => {
      setSelectedTheme(theme);
      previewTheme(theme);
    },
    [previewTheme]
  );

  /**
   * Updates the selected display size preset and previews zoom on the live app.
   */
  const handlePresetChange = useCallback(
    (preset: ZoomPreset): void => {
      setSelectedPreset(preset);
      previewZoom(preset);
    },
    [previewZoom]
  );

  /**
   * Persists the selected theme and display size, then closes the modal.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    setSaving(true);
    try {
      await applyThemePreference(selectedTheme);
      await window.api.setTheme(selectedTheme);
      await window.api.setZoomFactor(zoomPresetToFactor(selectedPreset));
      await window.api.markThemePickerSeen();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [onClose, selectedPreset, selectedTheme]);

  /**
   * Reverts to the theme and zoom that were active when the modal opened.
   */
  const handleDismiss = useCallback((): void => {
    if (saving) {
      return;
    }
    void (async () => {
      await previewThemePreference(initialTheme);
      await window.api.previewZoomFactor(initialZoom);
      await window.api.markThemePickerSeen();
      onClose();
    })();
  }, [initialTheme, initialZoom, onClose, saving]);

  /**
   * Previews the default theme and display size selections when the modal body mounts.
   */
  useEffect(() => {
    previewTheme(selectedTheme);
  }, [previewTheme, selectedTheme]);

  /**
   * Previews the initial display size preset when the modal body mounts.
   */
  useEffect(() => {
    previewZoom(selectedPreset);
  }, [previewZoom, selectedPreset]);

  return (
    <Modal
      onClose={handleDismiss}
      labelledBy="theme-picker-title"
      title="Choose your theme"
      description="Preview how HarborClient looks in each appearance theme and display size."
      className="w-[min(42rem,calc(100vw-2rem))]"
      overlayClassName="bg-black/35"
      closeDisabled={saving}
      disableEscape={saving}
    >
      <div
        role="radiogroup"
        aria-labelledby="theme-picker-title"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4"
      >
        {BUILTIN_THEME_OPTIONS.map((option) => (
          <ThemePreviewCard
            key={option.value}
            theme={option.value as BuiltinThemeSource}
            label={option.label}
            selected={selectedTheme === option.value}
            radioGroupName={RADIO_GROUP_NAME}
            onSelect={handleSelect}
          />
        ))}
      </div>
      <div className="mb-4">
        <span id="theme-picker-zoom-label" className="mb-2 block font-medium text-text">
          Display size
        </span>
        <SegmentedTabs
          pattern="radiogroup"
          aria-labelledby="theme-picker-zoom-label"
          fullWidth
          value={selectedPreset}
          onChange={handlePresetChange}
          tabs={[...ZOOM_PRESET_OPTIONS]}
        />
      </div>
      <ModalFooter>
        <Button type="button" variant="secondary" disabled={saving} onClick={handleDismiss}>
          Not now
        </Button>
        <Button type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

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
