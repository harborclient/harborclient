import { useEffect, useState, type JSX } from 'react';
import type { FirestoreSettings } from '#/shared/types';
import { field, primaryButton } from '#/renderer/src/ui/classes';
import { DEFAULT_FIRESTORE_SETTINGS } from './constants';

/**
 * Firestore connection and sign-in credentials.
 */
export function FirestoreSection(): JSX.Element {
  const [firestoreSettings, setFirestoreSettings] = useState<FirestoreSettings>(
    DEFAULT_FIRESTORE_SETTINGS
  );
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [firestoreSaving, setFirestoreSaving] = useState(false);
  const [firestoreSaved, setFirestoreSaved] = useState(false);

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
          {firestoreSaved && <span className="text-[12px] text-success">Settings saved.</span>}
        </div>

        <p className="m-0 text-[12px] text-muted">
          Changes take effect after restarting HarborClient.
        </p>
      </div>
    </div>
  );
}
