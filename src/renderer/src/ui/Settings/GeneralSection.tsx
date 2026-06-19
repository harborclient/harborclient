import { useEffect, useState, type JSX } from 'react';
import type { DatabaseProvider, ThemeSource } from '#/shared/types';
import { field } from '#/renderer/src/ui/classes';
import { PROVIDER_OPTIONS, THEME_OPTIONS } from './constants';

/**
 * General settings: appearance and database provider.
 */
export function GeneralSection(): JSX.Element {
  const [theme, setTheme] = useState<ThemeSource>('system');
  const [loading, setLoading] = useState(true);
  const [databaseProvider, setDatabaseProvider] = useState<DatabaseProvider>('sqlite');
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);

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
    window.api.getDatabaseProvider().then((value) => {
      if (!cancelled) {
        setDatabaseProvider(value);
        setProviderLoading(false);
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
   * Persists the selected database provider.
   *
   * @param next - Provider to use on next launch.
   */
  const handleProviderChange = async (next: DatabaseProvider): Promise<void> => {
    setDatabaseProvider(next);
    setProviderSaved(false);
    setProviderSaving(true);
    try {
      await window.api.setDatabaseProvider(next);
      setProviderSaved(true);
    } finally {
      setProviderSaving(false);
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-6">
      <div>
        <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Appearance</h2>
        <p className="mb-3 text-[12px] text-muted">
          Choose light, dark, or match your system preference.
        </p>

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
      </div>

      <div>
        <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Database provider</h2>
        <p className="mb-3 text-[12px] text-muted">
          Choose whether collections and requests are stored in SQLite or Firestore.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text">Provider</span>
          <select
            className={field}
            value={databaseProvider}
            disabled={providerLoading || providerSaving}
            onChange={(event) =>
              void handleProviderChange(event.target.value as DatabaseProvider)
            }
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex items-center gap-3">
          {providerSaving && <span className="text-[12px] text-muted">Saving provider…</span>}
          {providerSaved && <span className="text-[12px] text-success">Provider saved.</span>}
        </div>

        <p className="mb-0 mt-3 text-[12px] text-muted">
          Changes take effect after restarting HarborClient.
        </p>
      </div>
    </div>
  );
}
