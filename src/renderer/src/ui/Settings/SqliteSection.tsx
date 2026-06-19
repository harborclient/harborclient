import { useEffect, useState, type JSX } from 'react';
import type { SqliteSettings } from '#/shared/types';
import { field, primaryButton } from '#/renderer/src/ui/classes';
import { DEFAULT_SQLITE_SETTINGS } from './constants';

/**
 * SQLite database filename and legacy migration settings.
 */
export function SqliteSection(): JSX.Element {
  const [sqliteSettings, setSqliteSettings] = useState<SqliteSettings>(DEFAULT_SQLITE_SETTINGS);
  const [sqliteLoading, setSqliteLoading] = useState(true);
  const [sqliteSaving, setSqliteSaving] = useState(false);
  const [sqliteSaved, setSqliteSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.getSqliteSettings().then((value) => {
      if (!cancelled) {
        setSqliteSettings(value);
        setSqliteLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Updates a SQLite settings field in local form state.
   *
   * @param key - Field to update.
   * @param value - New field value.
   */
  const handleSqliteFieldChange = (key: keyof SqliteSettings, value: string): void => {
    setSqliteSaved(false);
    setSqliteSettings((current) => ({ ...current, [key]: value }));
  };

  /**
   * Persists SQLite settings to electron-store.
   */
  const handleSqliteSave = async (): Promise<void> => {
    setSqliteSaving(true);
    setSqliteSaved(false);
    try {
      await window.api.setSqliteSettings(sqliteSettings);
      setSqliteSaved(true);
    } finally {
      setSqliteSaving(false);
    }
  };

  return (
    <div className="mb-6">
      <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Database</h2>
      <p className="mb-3 text-[12px] text-muted">
        Configure the SQLite database filename and legacy migration paths.
      </p>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text">Database filename</span>
          <input
            type="text"
            className={field}
            value={sqliteSettings.dbFilename}
            disabled={sqliteLoading || sqliteSaving}
            onChange={(event) => handleSqliteFieldChange('dbFilename', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text">Legacy database filename</span>
          <input
            type="text"
            className={field}
            value={sqliteSettings.legacyDbFilename}
            disabled={sqliteLoading || sqliteSaving}
            onChange={(event) => handleSqliteFieldChange('legacyDbFilename', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text">Legacy data directory</span>
          <input
            type="text"
            className={field}
            value={sqliteSettings.legacyUserDataDir}
            disabled={sqliteLoading || sqliteSaving}
            onChange={(event) => handleSqliteFieldChange('legacyUserDataDir', event.target.value)}
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className={primaryButton}
            disabled={sqliteLoading || sqliteSaving}
            onClick={() => void handleSqliteSave()}
          >
            {sqliteSaving ? 'Saving…' : 'Save'}
          </button>
          {sqliteSaved && <span className="text-[12px] text-success">Settings saved.</span>}
        </div>

        <p className="m-0 text-[12px] text-muted">
          Changes take effect after restarting HarborClient.
        </p>
      </div>
    </div>
  );
}
