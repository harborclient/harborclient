import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { BUILTIN_THEME_OPTIONS } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';
import {
  ZOOM_PRESET_OPTIONS,
  zoomFactorToPreset,
  zoomPresetToFactor,
  type ZoomPreset
} from '#/shared/zoomPresets';
import { previewThemePreference, applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { ThemePreviewCard } from '#/renderer/src/ui/Modals/ThemePickerModal/ThemePreviewCard';
import type { BuiltinThemeSource } from '#/renderer/src/ui/Modals/ThemePickerModal/previewPalettes';
import {
  Button,
  Modal,
  ModalFooter,
  SegmentedTabs,
  resolveTabListKeyAction
} from '@harborclient/sdk/components';

const RADIO_GROUP_NAME = 'theme-picker-selection';

const THEME_OPTIONS = BUILTIN_THEME_OPTIONS.map((option) => option.value as BuiltinThemeSource);

interface Props {
  /**
   * Theme active when the modal opened; restored on dismiss without save.
   */
  initialTheme: ThemeSource;

  /**
   * Zoom factor active when the modal opened; restored on dismiss without save.
   */
  initialZoom: number;

  /**
   * Dismisses the modal and reverts to the initial theme and zoom.
   */
  onClose: () => void;
}

/**
 * Renders theme cards, display size presets, live previews, and save/dismiss actions.
 */
export function ThemePickerModalBody({ initialTheme, initialZoom, onClose }: Props): JSX.Element {
  const [selectedTheme, setSelectedTheme] = useState<BuiltinThemeSource>('system');
  const [selectedPreset, setSelectedPreset] = useState<ZoomPreset>(() =>
    zoomFactorToPreset(initialZoom)
  );
  const [saving, setSaving] = useState(false);
  const themeCardRefs = useRef(new Map<BuiltinThemeSource, HTMLButtonElement>());

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
   * Moves theme selection with arrow, Home, and End keys within the theme radiogroup.
   */
  const handleThemeGroupKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      const currentIndex = THEME_OPTIONS.indexOf(selectedTheme);
      const nextIndex = resolveTabListKeyAction(event.key, currentIndex, THEME_OPTIONS.length);
      if (nextIndex === null) {
        return;
      }

      event.preventDefault();
      const nextTheme = THEME_OPTIONS[nextIndex];
      if (nextTheme !== selectedTheme) {
        handleSelect(nextTheme);
      }

      requestAnimationFrame(() => {
        themeCardRefs.current.get(nextTheme)?.focus();
      });
    },
    [handleSelect, selectedTheme]
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
      aria-busy={saving}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {saving ? 'Saving theme and display size' : ''}
      </p>
      <div className="mb-4">
        <span id="theme-picker-theme-label" className="mb-2 block font-medium text-text">
          Theme
        </span>
        <div
          role="radiogroup"
          aria-labelledby="theme-picker-theme-label"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          onKeyDown={handleThemeGroupKeyDown}
        >
          {BUILTIN_THEME_OPTIONS.map((option) => {
            const theme = option.value as BuiltinThemeSource;
            const selected = selectedTheme === theme;

            return (
              <ThemePreviewCard
                key={option.value}
                theme={theme}
                label={option.label}
                selected={selected}
                radioGroupName={RADIO_GROUP_NAME}
                tabIndex={selected ? 0 : -1}
                autoFocus={selected}
                registerButtonRef={(element) => {
                  if (element) {
                    themeCardRefs.current.set(theme, element);
                  } else {
                    themeCardRefs.current.delete(theme);
                  }
                }}
                onSelect={handleSelect}
              />
            );
          })}
        </div>
      </div>
      <div className="mb-4">
        <span id="theme-picker-zoom-label" className="mb-2 block font-medium text-text">
          Display size
        </span>
        <SegmentedTabs
          pattern="radiogroup"
          ariaLabel="Display size"
          editable={false}
          fullWidth
          value={selectedPreset}
          onChange={handlePresetChange}
          tabs={[...ZOOM_PRESET_OPTIONS]}
        />
      </div>
      <ModalFooter aria-busy={saving}>
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
