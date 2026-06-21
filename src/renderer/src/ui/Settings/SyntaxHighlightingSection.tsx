import { useEffect, useState, type JSX } from 'react';
import { CodeEditor } from '#/renderer/src/components/CodeEditor';
import { CODE_EDITOR_THEME_OPTIONS } from '#/renderer/src/components/codeEditorThemes';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setGeneralSettingsState } from '#/renderer/src/store/slices/settingsSlice';
import type { CodeEditorSetup, GeneralSettings } from '#/shared/types';
import { field, primaryButton } from '#/renderer/src/ui/shared/classes';
import { DEFAULT_GENERAL_SETTINGS } from './constants';

const PREVIEW_SAMPLE = `const response = hc.response.json();
console.log(response);
if (response.idToken) {
    hc.collection.variables.set('idToken', response.idToken);
}`;

const SETUP_OPTIONS: Array<{ key: keyof CodeEditorSetup; label: string }> = [
  { key: 'lineNumbers', label: 'Line numbers' },
  { key: 'foldGutter', label: 'Code folding gutter' },
  { key: 'highlightActiveLine', label: 'Highlight active line' },
  { key: 'highlightActiveLineGutter', label: 'Highlight active line gutter' }
];

/**
 * Syntax highlighting settings: CodeMirror theme, editor setup toggles, and live preview.
 */
export function SyntaxHighlightingSection(): JSX.Element {
  const dispatch = useAppDispatch();
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /**
   * Loads general settings on mount so code editor fields are populated from storage.
   */
  useEffect(() => {
    let cancelled = false;
    window.api.getGeneralSettings().then((value) => {
      if (!cancelled) {
        setGeneralSettings(value);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Updates the selected CodeMirror theme in local form state.
   *
   * @param codeEditorTheme - Theme identifier from the dropdown.
   */
  const handleThemeChange = (codeEditorTheme: GeneralSettings['codeEditorTheme']): void => {
    setSaved(false);
    setGeneralSettings((current) => ({ ...current, codeEditorTheme }));
  };

  /**
   * Updates a single CodeMirror setup flag in local form state.
   *
   * @param key - Setup field to update.
   * @param value - New checkbox value.
   */
  const handleSetupChange = (key: keyof CodeEditorSetup, value: boolean): void => {
    setSaved(false);
    setGeneralSettings((current) => ({
      ...current,
      codeEditorSetup: { ...current.codeEditorSetup, [key]: value }
    }));
  };

  /**
   * Persists syntax highlighting settings and updates the renderer store.
   */
  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setSaved(false);
    try {
      await window.api.setGeneralSettings(generalSettings);
      dispatch(setGeneralSettingsState(generalSettings));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text">Theme</span>
          <select
            className={field}
            value={generalSettings.codeEditorTheme}
            disabled={loading || saving}
            onChange={(event) =>
              handleThemeChange(event.target.value as GeneralSettings['codeEditorTheme'])
            }
          >
            {CODE_EDITOR_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {SETUP_OPTIONS.map((option) => (
          <label key={option.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={generalSettings.codeEditorSetup[option.key]}
              disabled={loading || saving}
              onChange={(event) => handleSetupChange(option.key, event.target.checked)}
            />
            <span className="text-[12px] font-medium text-text">{option.label}</span>
          </label>
        ))}

        <div className="flex items-center gap-3">
          <button
            type="button"
            className={primaryButton}
            disabled={loading || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-[12px] text-success">Settings saved.</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-medium text-text">Preview</span>
        <CodeEditor
          value={PREVIEW_SAMPLE}
          readOnly
          language="javascript"
          minHeight="120px"
          themeOverride={generalSettings.codeEditorTheme}
          setupOverride={generalSettings.codeEditorSetup}
        />
      </div>
    </div>
  );
}
