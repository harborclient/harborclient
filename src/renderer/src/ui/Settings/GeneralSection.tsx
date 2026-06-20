import { useEffect, useState, type JSX } from 'react';
import type { GeneralSettings, ThemeSource } from '#/shared/types';
import { field, primaryButton } from '#/renderer/src/ui/shared/classes';
import { DEFAULT_GENERAL_SETTINGS, THEME_OPTIONS } from './constants';

/**
 * General settings: appearance and HTTP request defaults.
 */
export function GeneralSection(): JSX.Element {
  const [theme, setTheme] = useState<ThemeSource>('system');
  const [loading, setLoading] = useState(true);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [generalLoading, setGeneralLoading] = useState(true);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.getTheme().then((value) => {
      if (!cancelled) {
        setTheme(value);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.api.getGeneralSettings().then((value) => {
      if (!cancelled) {
        setGeneralSettings(value);
        setGeneralLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Persists and applies the selected theme.
   *
   * @param next - Theme source to apply.
   */
  const handleThemeChange = async (next: ThemeSource): Promise<void> => {
    setTheme(next);
    await window.api.setTheme(next);
  };

  /**
   * Updates a general settings field in local form state.
   *
   * @param key - Field to update.
   * @param value - New field value.
   */
  const handleGeneralFieldChange = <K extends keyof GeneralSettings>(
    key: K,
    value: GeneralSettings[K]
  ): void => {
    setGeneralSaved(false);
    setGeneralSettings((current) => ({ ...current, [key]: value }));
  };

  /**
   * Persists general request settings.
   */
  const handleGeneralSave = async (): Promise<void> => {
    setGeneralSaving(true);
    setGeneralSaved(false);
    try {
      await window.api.setGeneralSettings(generalSettings);
      setGeneralSaved(true);
    } finally {
      setGeneralSaving(false);
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="mb-6 flex flex-col gap-6">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text">Theme</span>
          <select
            className={field}
            value={theme}
            disabled={loading}
            onChange={(event) => void handleThemeChange(event.target.value as ThemeSource)}
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text">Request timeout (ms)</span>
          <input
            type="number"
            min={0}
            className={field}
            value={generalSettings.requestTimeoutMs}
            disabled={generalLoading || generalSaving}
            onChange={(event) =>
              handleGeneralFieldChange('requestTimeoutMs', Number(event.target.value))
            }
          />
          <p className="m-0 text-[12px] text-muted">Set to 0 to disable the limit.</p>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text">Max response size (MB)</span>
          <input
            type="number"
            min={0}
            className={field}
            value={generalSettings.maxResponseSizeMb}
            disabled={generalLoading || generalSaving}
            onChange={(event) =>
              handleGeneralFieldChange('maxResponseSizeMb', Number(event.target.value))
            }
          />
          <p className="m-0 text-[12px] text-muted">
            Set to 0 for no configurable limit (512 MB hard cap still applies).
          </p>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={generalSettings.verifySsl}
            disabled={generalLoading || generalSaving}
            onChange={(event) => handleGeneralFieldChange('verifySsl', event.target.checked)}
          />
          <span className="text-[12px] font-medium text-text">SSL certificate verification</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={primaryButton}
          disabled={generalLoading || generalSaving}
          onClick={() => void handleGeneralSave()}
        >
          {generalSaving ? 'Saving…' : 'Save'}
        </button>
        {generalSaved && <span className="text-[12px] text-success">Settings saved.</span>}
      </div>
    </div>
  );
}
