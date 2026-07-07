import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeColorToken } from '@harborclient/sdk';
import { customThemeToEnvelope, formatCustomThemeValue } from '#/shared/plugin/customThemeExport';
import type { CustomTheme, CustomThemeType } from '#/shared/types/customTheme';
import { applyCustomThemeColors, applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import {
  inferActiveThemeType,
  readActiveThemePalette
} from '#/renderer/src/ui/Plugins/activeThemePalette';
import {
  DEFAULT_CUSTOM_THEME_TITLE,
  getDefaultCustomThemePalette
} from '#/renderer/src/ui/Plugins/customThemeDefaults';
import { shouldPromptRenamedThemeSave } from '#/renderer/src/ui/Plugins/shouldPromptRenamedThemeSave';

/**
 * State shown when saving a renamed existing custom theme.
 */
export interface RenamedThemeSavePrompt {
  /** Previously saved theme title. */
  originalTitle: string;

  /** Title entered in the Creator form. */
  newTitle: string;
}

/**
 * Draft state for the Creator form.
 */
export interface CustomThemeDraft {
  /**
   * Existing filename stem when editing a saved theme.
   */
  id?: string;

  /**
   * Human-readable theme title.
   */
  title: string;

  /**
   * Base appearance mode.
   */
  type: CustomThemeType;

  /**
   * Token overrides without the `--mac-` prefix.
   */
  colors: Partial<Record<ThemeColorToken, string>>;
}

interface Options {
  /**
   * Existing custom theme id to edit, if any.
   */
  editingId?: string | null;

  /**
   * Called after a theme is saved so Installed cards can refresh.
   */
  onSaved?: (theme: CustomTheme) => void;
}

/**
 * Return type for {@link useCustomTheme}.
 */
export interface UseCustomThemeResult {
  draft: CustomThemeDraft;
  loading: boolean;
  busy: boolean;
  error: string | null;
  canSave: boolean;
  renamePrompt: RenamedThemeSavePrompt | null;
  handleColorChange: (token: ThemeColorToken, value: string) => void;
  handleTitleChange: (title: string) => void;
  handleTypeChange: (type: CustomThemeType) => void;
  handleDiscard: () => void;
  handleSave: () => Promise<void>;
  handleRenameSaveExisting: () => Promise<void>;
  handleRenameSaveAsNew: () => Promise<void>;
  handleRenameCancel: () => void;
  handleExport: () => Promise<void>;
  handleImport: () => Promise<void>;
}

/**
 * Manages Creator draft state, live preview, save/discard, and import/export actions.
 *
 * @param options - Hook configuration for edit mode and save callbacks.
 * @returns Creator form state and handlers.
 */
export function useCustomTheme({ editingId, onSaved }: Options): UseCustomThemeResult {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamePrompt, setRenamePrompt] = useState<RenamedThemeSavePrompt | null>(null);
  const [draft, setDraft] = useState<CustomThemeDraft>({
    title: DEFAULT_CUSTOM_THEME_TITLE,
    type: 'light',
    colors: getDefaultCustomThemePalette('light')
  });
  const persistedDraftRef = useRef<CustomThemeDraft>(draft);
  const activeThemeRef = useRef<string>('system');

  /**
   * Loads the theme under edit or seeds a new draft from the active theme palette.
   */
  useEffect(() => {
    let active = true;

    if (!editingId) {
      void (async () => {
        const theme = await window.api.getTheme();
        if (!active) {
          return;
        }
        activeThemeRef.current = theme;
        const type = await inferActiveThemeType(theme);
        if (!active) {
          return;
        }
        const seeded: CustomThemeDraft = {
          title: DEFAULT_CUSTOM_THEME_TITLE,
          type,
          colors: readActiveThemePalette(type)
        };
        setDraft(seeded);
        persistedDraftRef.current = seeded;
        setLoading(false);
      })();
      return () => {
        active = false;
      };
    }

    void window.api.getTheme().then((theme) => {
      if (active) {
        activeThemeRef.current = theme;
      }
    });

    void window.api.getCustomTheme(editingId).then((theme) => {
      if (!active) {
        return;
      }

      if (!theme) {
        const seeded: CustomThemeDraft = {
          title: DEFAULT_CUSTOM_THEME_TITLE,
          type: 'light',
          colors: getDefaultCustomThemePalette('light')
        };
        setDraft(seeded);
        persistedDraftRef.current = seeded;
        setLoading(false);
        return;
      }

      const loaded: CustomThemeDraft = {
        id: theme.id,
        title: theme.title,
        type: theme.type,
        colors: { ...theme.colors }
      };
      setDraft(loaded);
      persistedDraftRef.current = loaded;
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [editingId]);

  /**
   * Live-previews the draft palette across the whole app while the Creator is open.
   */
  useEffect(() => {
    if (loading) {
      return;
    }
    applyCustomThemeColors(draft.colors, draft.type);
  }, [draft, loading]);

  /**
   * Restores the persisted active theme when leaving the Creator without saving.
   */
  useEffect(() => {
    return () => {
      void applyThemePreference(activeThemeRef.current);
    };
  }, []);

  /**
   * Updates one token color in the draft.
   */
  const handleColorChange = useCallback((token: ThemeColorToken, value: string): void => {
    setDraft((current) => ({
      ...current,
      colors: {
        ...current.colors,
        [token]: value
      }
    }));
  }, []);

  /**
   * Updates the theme title in the draft.
   */
  const handleTitleChange = useCallback((title: string): void => {
    setDraft((current) => ({ ...current, title }));
  }, []);

  /**
   * Reseeds the draft palette when the base appearance mode changes.
   */
  const handleTypeChange = useCallback((type: CustomThemeType): void => {
    setDraft((current) => ({
      ...current,
      type,
      colors: getDefaultCustomThemePalette(type)
    }));
  }, []);

  /**
   * Resets the draft to the last loaded or saved snapshot and restores the active theme.
   */
  const handleDiscard = useCallback((): void => {
    setDraft(persistedDraftRef.current);
    void applyThemePreference(activeThemeRef.current);
  }, []);

  /**
   * Persists the current draft, optionally creating a new theme file.
   *
   * @param saveAsNew - When true, omits the existing id so a new theme file is created.
   */
  const performSave = useCallback(
    async (saveAsNew: boolean): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const saved = await window.api.saveCustomTheme({
          id: saveAsNew ? undefined : draft.id,
          title: draft.title,
          type: draft.type,
          colors: draft.colors
        });
        const nextDraft: CustomThemeDraft = {
          id: saved.id,
          title: saved.title,
          type: saved.type,
          colors: { ...saved.colors }
        };
        setDraft(nextDraft);
        persistedDraftRef.current = nextDraft;
        const themeValue = formatCustomThemeValue(saved.id);
        await window.api.setTheme(themeValue);
        activeThemeRef.current = themeValue;
        setRenamePrompt(null);
        onSaved?.(saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [draft, onSaved]
  );

  /**
   * Saves the draft to disk and makes it the active theme.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (shouldPromptRenamedThemeSave(persistedDraftRef.current, draft)) {
      setRenamePrompt({
        originalTitle: persistedDraftRef.current.title,
        newTitle: draft.title
      });
      return;
    }

    await performSave(false);
  }, [draft, performSave]);

  /**
   * Renames the existing saved theme in place and persists the current draft.
   */
  const handleRenameSaveExisting = useCallback(async (): Promise<void> => {
    await performSave(false);
  }, [performSave]);

  /**
   * Saves the current draft as a new theme while leaving the original file unchanged.
   */
  const handleRenameSaveAsNew = useCallback(async (): Promise<void> => {
    await performSave(true);
  }, [performSave]);

  /**
   * Dismisses the rename save prompt without persisting changes.
   */
  const handleRenameCancel = useCallback((): void => {
    setRenamePrompt(null);
  }, []);

  /**
   * Exports the current draft as a portable theme JSON file.
   */
  const handleExport = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const envelope = customThemeToEnvelope({
        id: draft.id ?? 'draft',
        title: draft.title,
        type: draft.type,
        colors: draft.colors
      });
      const defaultPath = `${draft.title || DEFAULT_CUSTOM_THEME_TITLE}.json`;
      const result = await window.api.saveTextFile(JSON.stringify(envelope, null, 2), defaultPath);
      if (result.canceled) {
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [draft]);

  /**
   * Imports a theme file into the draft without saving or activating it.
   */
  const handleImport = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const imported = await window.api.importCustomTheme();
      if (!imported) {
        return;
      }
      setDraft((current) => ({
        ...current,
        title: imported.title,
        type: imported.type,
        colors: { ...imported.colors }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const canSave = useMemo(() => draft.title.trim().length > 0, [draft.title]);

  return {
    draft,
    loading,
    busy,
    error,
    canSave,
    renamePrompt,
    handleColorChange,
    handleTitleChange,
    handleTypeChange,
    handleDiscard,
    handleSave,
    handleRenameSaveExisting,
    handleRenameSaveAsNew,
    handleRenameCancel,
    handleExport,
    handleImport
  };
}
