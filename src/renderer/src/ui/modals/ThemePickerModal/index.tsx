import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { BUILTIN_THEME_OPTIONS } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';
import { previewThemePreference, applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeThemePicker, selectThemePicker } from '#/renderer/src/store/slices/modalsSlice';
import { ThemePreviewCard } from '#/renderer/src/ui/modals/ThemePickerModal/ThemePreviewCard';
import type { BuiltinThemeSource } from '#/renderer/src/ui/modals/ThemePickerModal/previewPalettes';
import { Button, Modal, ModalFooter } from '@harborclient/sdk/components';

const RADIO_GROUP_NAME = 'theme-picker-selection';

interface ModalBodyProps {
  /** Theme active when the modal opened; restored on dismiss without save. */
  initialTheme: ThemeSource;
  /** Dismisses the modal and reverts to the initial theme. */
  onClose: () => void;
}

/**
 * Renders theme cards, live-previews selections, and save/dismiss actions.
 */
function ThemePickerModalBody({ initialTheme, onClose }: ModalBodyProps): JSX.Element {
  const [selectedTheme, setSelectedTheme] = useState<BuiltinThemeSource>('system');
  const [saving, setSaving] = useState(false);

  /**
   * Applies the selected theme to the app behind the modal for live preview.
   */
  const previewTheme = useCallback((theme: BuiltinThemeSource): void => {
    void previewThemePreference(theme);
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
   * Persists the selected theme and closes the modal.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    setSaving(true);
    try {
      await applyThemePreference(selectedTheme);
      await window.api.setTheme(selectedTheme);
      await window.api.markThemePickerSeen();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [onClose, selectedTheme]);

  /**
   * Reverts to the theme that was active when the modal opened.
   */
  const handleDismiss = useCallback((): void => {
    if (saving) {
      return;
    }
    void (async () => {
      await previewThemePreference(initialTheme);
      await window.api.markThemePickerSeen();
      onClose();
    })();
  }, [initialTheme, onClose, saving]);

  /**
   * Previews the default selection when the modal body mounts.
   */
  useEffect(() => {
    previewTheme(selectedTheme);
  }, [previewTheme, selectedTheme]);

  return (
    <Modal
      onClose={handleDismiss}
      labelledBy="theme-picker-title"
      title="Choose your theme"
      description="Preview how HarborClient looks in each appearance theme."
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
 * First-run modal that lets the user preview and pick a built-in appearance theme.
 */
export function ThemePickerModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const themePicker = useAppSelector(selectThemePicker);
  const [initialTheme, setInitialTheme] = useState<ThemeSource | null>(null);
  const loadingInitialTheme = useRef(false);

  /**
   * Closes the theme picker modal in Redux state.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeThemePicker());
    setInitialTheme(null);
  }, [dispatch]);

  /**
   * Captures the active theme when the modal opens so dismiss can revert cleanly.
   */
  useEffect(() => {
    if (!themePicker?.open || loadingInitialTheme.current || initialTheme != null) {
      return;
    }

    loadingInitialTheme.current = true;
    void window.api.getTheme().then((theme) => {
      setInitialTheme(theme);
      loadingInitialTheme.current = false;
    });
  }, [initialTheme, themePicker?.open]);

  if (!themePicker?.open || initialTheme == null) {
    return null;
  }

  return (
    <ThemePickerModalBody key="theme-picker" initialTheme={initialTheme} onClose={handleClose} />
  );
}
