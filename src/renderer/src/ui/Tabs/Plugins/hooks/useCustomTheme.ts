import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeColorToken } from '@harborclient/sdk';
import { customThemeToEnvelope, formatCustomThemeValue } from '#/shared/plugin/customThemeExport';
import type { CustomTheme, CustomThemeType } from '#/shared/types/customTheme';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  commitBaseline,
  initializeSession,
  recordImmediate,
  redo,
  resetToPersisted,
  selectThemeDesignerActiveThemeAtOpen,
  selectThemeDesignerCanRedo,
  selectThemeDesignerCanUndo,
  selectThemeDesignerDraft,
  selectThemeDesignerEditingId,
  selectThemeDesignerInitialized,
  selectThemeDesignerPersistedDraft,
  sessionSaved,
  setPresent,
  undo
} from '#/renderer/src/store/slices/themeDesignerSlice';
import { applyCustomThemeColors, applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import {
  inferActiveThemeType,
  readActiveThemePalette
} from '#/renderer/src/ui/Tabs/Plugins/activeThemePalette';
import {
  DEFAULT_CUSTOM_THEME_TITLE,
  getDefaultCustomThemePalette
} from '#/renderer/src/ui/Tabs/Plugins/customThemeDefaults';
import { shouldPromptRenamedThemeSave } from '#/renderer/src/ui/Tabs/Plugins/shouldPromptRenamedThemeSave';
import { customThemeDraftsEqual, THEME_HISTORY_DEBOUNCE_MS } from './themeHistoryStack';

/**
 * State shown when saving a renamed existing custom theme.
 */
export interface RenamedThemeSavePrompt {
  /** Previously saved theme title. */
  originalTitle: string;

  /** Title entered in the Designer form. */
  newTitle: string;
}

/**
 * Draft state for the Designer form.
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

  /**
   * Optional extra CSS appended after token overrides when the theme is applied.
   */
  stylesheet?: string;
}

interface Options {
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
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  renamePrompt: RenamedThemeSavePrompt | null;
  handleColorChange: (token: ThemeColorToken, value: string) => void;
  handleTitleChange: (title: string) => void;
  handleTitleBlur: () => void;
  handleTypeChange: (type: CustomThemeType) => void;
  handleDiscard: () => void;
  handleSave: () => Promise<void>;
  handleRenameSaveExisting: () => Promise<void>;
  handleRenameSaveAsNew: () => Promise<void>;
  handleRenameCancel: () => void;
  handleExport: () => Promise<void>;
  handleImport: () => Promise<void>;
  undo: () => void;
  redo: () => void;
}

/**
 * Manages Designer draft state, live preview, save/discard, and import/export actions.
 *
 * @param options - Hook configuration for save callbacks.
 * @returns Designer form state and handlers.
 */
export function useCustomTheme({ onSaved }: Options): UseCustomThemeResult {
  const dispatch = useAppDispatch();
  const editingId = useAppSelector(selectThemeDesignerEditingId);
  const initialized = useAppSelector(selectThemeDesignerInitialized);
  const draft = useAppSelector(selectThemeDesignerDraft);
  const persistedDraft = useAppSelector(selectThemeDesignerPersistedDraft);
  const activeThemeAtOpen = useAppSelector(selectThemeDesignerActiveThemeAtOpen);
  const canUndo = useAppSelector(selectThemeDesignerCanUndo);
  const canRedo = useAppSelector(selectThemeDesignerCanRedo);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamePrompt, setRenamePrompt] = useState<RenamedThemeSavePrompt | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceBaselineRef = useRef<CustomThemeDraft | null>(null);

  const loading = !initialized;

  /**
   * Clears any pending debounced history commit and pushes the captured baseline.
   */
  const flushDebounce = useCallback((): void => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const baseline = debounceBaselineRef.current;
    debounceBaselineRef.current = null;
    if (baseline == null) {
      return;
    }

    dispatch(commitBaseline(baseline));
  }, [dispatch]);

  /**
   * Clears debounce timers when the hook unmounts.
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Loads the theme under edit or seeds a new draft from the active theme palette.
   */
  useEffect(() => {
    if (initialized) {
      return;
    }

    let active = true;

    if (!editingId) {
      void (async () => {
        const theme = await window.api.getTheme();
        if (!active) {
          return;
        }
        const type = await inferActiveThemeType(theme);
        if (!active) {
          return;
        }
        const seeded: CustomThemeDraft = {
          title: DEFAULT_CUSTOM_THEME_TITLE,
          type,
          colors: readActiveThemePalette(type)
        };
        dispatch(initializeSession({ draft: seeded, activeTheme: theme }));
      })();
      return () => {
        active = false;
      };
    }

    void (async () => {
      const theme = await window.api.getTheme();
      if (!active) {
        return;
      }

      const customTheme = await window.api.getCustomTheme(editingId);
      if (!active) {
        return;
      }

      if (!customTheme) {
        const seeded: CustomThemeDraft = {
          title: DEFAULT_CUSTOM_THEME_TITLE,
          type: 'light',
          colors: getDefaultCustomThemePalette('light')
        };
        dispatch(initializeSession({ draft: seeded, activeTheme: theme }));
        return;
      }

      const loaded: CustomThemeDraft = {
        id: customTheme.id,
        title: customTheme.title,
        type: customTheme.type,
        colors: { ...customTheme.colors },
        ...(customTheme.stylesheet !== undefined ? { stylesheet: customTheme.stylesheet } : {})
      };
      dispatch(initializeSession({ draft: loaded, activeTheme: theme }));
    })();

    return () => {
      active = false;
    };
  }, [dispatch, editingId, initialized]);

  /**
   * Live-previews the draft palette across the whole app while the Designer is open.
   *
   * The applied palette intentionally persists when this component unmounts (for
   * example when the user switches to another tab) so edits can be previewed
   * app-wide. Reverting to the real active theme happens on session teardown via
   * {@link discardThemeDesignerSession}, not on unmount.
   */
  useEffect(() => {
    if (loading) {
      return;
    }
    applyCustomThemeColors(draft.colors, draft.type, draft.stylesheet);
  }, [draft, loading]);

  /**
   * Updates one token color in the draft, coalescing rapid picker drags into one undo step.
   */
  const handleColorChange = useCallback(
    (token: ThemeColorToken, value: string): void => {
      const next: CustomThemeDraft = {
        ...draft,
        colors: {
          ...draft.colors,
          [token]: value
        }
      };

      if (debounceBaselineRef.current == null) {
        debounceBaselineRef.current = draft;
      }
      dispatch(setPresent(next));

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const baseline = debounceBaselineRef.current;
        debounceBaselineRef.current = null;
        if (baseline == null) {
          return;
        }
        dispatch(commitBaseline(baseline));
      }, THEME_HISTORY_DEBOUNCE_MS);
    },
    [dispatch, draft]
  );

  /**
   * Updates the theme title in the draft without recording an undo step until blur.
   */
  const handleTitleChange = useCallback(
    (title: string): void => {
      dispatch(setPresent({ ...draft, title }));
    },
    [dispatch, draft]
  );

  /**
   * Commits the current title edit as one undo step when the title field loses focus.
   */
  const handleTitleBlur = useCallback((): void => {
    flushDebounce();
    dispatch(recordImmediate(draft));
  }, [dispatch, draft, flushDebounce]);

  /**
   * Reseeds the draft palette when the base appearance mode changes.
   */
  const handleTypeChange = useCallback(
    (type: CustomThemeType): void => {
      flushDebounce();
      dispatch(
        recordImmediate({
          ...draft,
          type,
          colors: getDefaultCustomThemePalette(type)
        })
      );
    },
    [dispatch, draft, flushDebounce]
  );

  /**
   * Resets the draft to the last loaded or saved snapshot and restores the active theme.
   */
  const handleDiscard = useCallback((): void => {
    flushDebounce();
    dispatch(resetToPersisted());
    void applyThemePreference(activeThemeAtOpen);
  }, [activeThemeAtOpen, dispatch, flushDebounce]);

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
          colors: draft.colors,
          ...(draft.stylesheet !== undefined ? { stylesheet: draft.stylesheet } : {})
        });
        const nextDraft: CustomThemeDraft = {
          id: saved.id,
          title: saved.title,
          type: saved.type,
          colors: { ...saved.colors },
          ...(saved.stylesheet !== undefined ? { stylesheet: saved.stylesheet } : {})
        };
        const themeValue = formatCustomThemeValue(saved.id);
        await window.api.setTheme(themeValue);
        dispatch(sessionSaved({ savedDraft: nextDraft, activeTheme: themeValue }));
        setRenamePrompt(null);
        onSaved?.(saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [dispatch, draft, onSaved]
  );

  /**
   * Saves the draft to disk and makes it the active theme.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (shouldPromptRenamedThemeSave(persistedDraft, draft)) {
      setRenamePrompt({
        originalTitle: persistedDraft.title,
        newTitle: draft.title
      });
      return;
    }

    await performSave(false);
  }, [draft, performSave, persistedDraft]);

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
        colors: draft.colors,
        ...(draft.stylesheet !== undefined ? { stylesheet: draft.stylesheet } : {})
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
      flushDebounce();
      dispatch(
        recordImmediate({
          ...draft,
          title: imported.title,
          type: imported.type,
          colors: { ...imported.colors },
          stylesheet: imported.stylesheet
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [dispatch, draft, flushDebounce]);

  /**
   * Moves one step backward in history when available.
   */
  const handleUndo = useCallback((): void => {
    flushDebounce();
    dispatch(undo());
  }, [dispatch, flushDebounce]);

  /**
   * Moves one step forward in history when available.
   */
  const handleRedo = useCallback((): void => {
    flushDebounce();
    dispatch(redo());
  }, [dispatch, flushDebounce]);

  const canSave = useMemo(() => draft.title.trim().length > 0, [draft.title]);
  const isDirty = useMemo(
    () => !customThemeDraftsEqual(draft, persistedDraft),
    [draft, persistedDraft]
  );

  return {
    draft,
    loading,
    busy,
    error,
    canSave,
    isDirty,
    canUndo,
    canRedo,
    renamePrompt,
    handleColorChange,
    handleTitleChange,
    handleTitleBlur,
    handleTypeChange,
    handleDiscard,
    handleSave,
    handleRenameSaveExisting,
    handleRenameSaveAsNew,
    handleRenameCancel,
    handleExport,
    handleImport,
    undo: handleUndo,
    redo: handleRedo
  };
}
