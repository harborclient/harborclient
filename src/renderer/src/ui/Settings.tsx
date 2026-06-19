import { useEffect, useState, type JSX } from 'react';
import type {
  DatabaseProvider,
  FirestoreSettings,
  SqliteSettings,
  ThemeSource
} from '#/shared/types';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { faXmark } from '#/renderer/src/fontawesome';
import { field, iconButton, primaryButton } from './classes';

interface Props {
  /**
   * Closes the settings view.
   */
  onClose: () => void;
}

type SettingsTab = 'general' | 'sqlite' | 'firestore';

const THEME_OPTIONS: Array<{ value: ThemeSource; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
];

const PROVIDER_OPTIONS: Array<{ value: DatabaseProvider; label: string }> = [
  { value: 'sqlite', label: 'SQLite' },
  { value: 'firestore', label: 'Firestore' }
];

const DEFAULT_SQLITE_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

const DEFAULT_FIRESTORE_SETTINGS: FirestoreSettings = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  email: '',
  password: ''
};

/**
 * Full-area application settings with General, SQLite, and Firestore tabs.
 */
export function Settings({ onClose }: Props): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [theme, setTheme] = useState<ThemeSource>('system');
  const [loading, setLoading] = useState(true);
  const [databaseProvider, setDatabaseProvider] = useState<DatabaseProvider>('sqlite');
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);
  const [sqliteSettings, setSqliteSettings] = useState<SqliteSettings>(DEFAULT_SQLITE_SETTINGS);
  const [sqliteLoading, setSqliteLoading] = useState(true);
  const [sqliteSaving, setSqliteSaving] = useState(false);
  const [sqliteSaved, setSqliteSaved] = useState(false);
  const [firestoreSettings, setFirestoreSettings] = useState<FirestoreSettings>(
    DEFAULT_FIRESTORE_SETTINGS
  );
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [firestoreSaving, setFirestoreSaving] = useState(false);
  const [firestoreSaved, setFirestoreSaved] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    window.api.getFirestoreSettings().then((value) => {
      if (!cancelled) {
        setFirestoreSettings(value);
        setFirestoreLoading(false);
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
   * Updates a Firestore settings field in local form state.
   *
   * @param key - Field to update.
   * @param value - New field value.
   */
  const handleFirestoreFieldChange = (key: keyof FirestoreSettings, value: string): void => {
    setFirestoreSaved(false);
    setFirestoreSettings((current) => ({ ...current, [key]: value }));
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

  /**
   * Persists Firestore settings to electron-store.
   */
  const handleFirestoreSave = async (): Promise<void> => {
    setFirestoreSaving(true);
    setFirestoreSaved(false);
    try {
      await window.api.setFirestoreSettings(firestoreSettings);
      setFirestoreSaved(true);
    } finally {
      setFirestoreSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="m-0 text-[15px] font-semibold text-text">Settings</h1>
          <button
            type="button"
            className={`${iconButton} opacity-100 text-[28px]`}
            title="Close"
            onClick={onClose}
          >
            <FaIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <SegmentedTabs
          value={tab}
          onChange={setTab}
          fullWidth
          className="mb-6"
          tabs={[
            { value: 'general', label: 'General' },
            { value: 'sqlite', label: 'SQLite' },
            { value: 'firestore', label: 'Firestore' }
          ]}
        />

        {tab === 'general' && (
          <div className="mb-6 flex flex-col gap-6">
            <div>
              <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Appearance</h2>
              <p className="mb-3 text-[12px] text-muted">
                Choose light, dark, or match your system preference.
              </p>

              <SegmentedTabs
                value={theme}
                onChange={(value) => void handleThemeChange(value)}
                fullWidth
                tabs={THEME_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                  disabled: loading
                }))}
              />
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
        )}

        {tab === 'sqlite' && (
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
                  onChange={(event) =>
                    handleSqliteFieldChange('legacyDbFilename', event.target.value)
                  }
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text">Legacy data directory</span>
                <input
                  type="text"
                  className={field}
                  value={sqliteSettings.legacyUserDataDir}
                  disabled={sqliteLoading || sqliteSaving}
                  onChange={(event) =>
                    handleSqliteFieldChange('legacyUserDataDir', event.target.value)
                  }
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
        )}

        {tab === 'firestore' && (
          <div className="mb-6">
            <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Firestore</h2>
            <p className="mb-3 text-[12px] text-muted">
              Configure Firebase connection settings and sign-in credentials.
            </p>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text">API key</span>
                <input
                  type="text"
                  className={field}
                  value={firestoreSettings.apiKey}
                  disabled={firestoreLoading || firestoreSaving}
                  onChange={(event) => handleFirestoreFieldChange('apiKey', event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text">Auth domain</span>
                <input
                  type="text"
                  className={field}
                  value={firestoreSettings.authDomain}
                  disabled={firestoreLoading || firestoreSaving}
                  onChange={(event) => handleFirestoreFieldChange('authDomain', event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text">Project ID</span>
                <input
                  type="text"
                  className={field}
                  value={firestoreSettings.projectId}
                  disabled={firestoreLoading || firestoreSaving}
                  onChange={(event) => handleFirestoreFieldChange('projectId', event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text">App ID</span>
                <input
                  type="text"
                  className={field}
                  value={firestoreSettings.appId}
                  disabled={firestoreLoading || firestoreSaving}
                  onChange={(event) => handleFirestoreFieldChange('appId', event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text">Email</span>
                <input
                  type="email"
                  className={field}
                  value={firestoreSettings.email}
                  disabled={firestoreLoading || firestoreSaving}
                  onChange={(event) => handleFirestoreFieldChange('email', event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text">Password</span>
                <input
                  type="password"
                  className={field}
                  value={firestoreSettings.password}
                  disabled={firestoreLoading || firestoreSaving}
                  onChange={(event) => handleFirestoreFieldChange('password', event.target.value)}
                />
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={primaryButton}
                  disabled={firestoreLoading || firestoreSaving}
                  onClick={() => void handleFirestoreSave()}
                >
                  {firestoreSaving ? 'Saving…' : 'Save'}
                </button>
                {firestoreSaved && (
                  <span className="text-[12px] text-success">Settings saved.</span>
                )}
              </div>

              <p className="m-0 text-[12px] text-muted">
                Changes take effect after restarting HarborClient.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
