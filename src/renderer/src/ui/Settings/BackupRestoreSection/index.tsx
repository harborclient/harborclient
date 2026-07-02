import { Button, Page } from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';

import { showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';
import { sectionEntryBySection } from '../catalog/catalog';
import { SettingLabel } from '../components/SettingLabel';
import { settingsSectionMeta } from '../constants';
import { applyLocalStorageSnapshot, collectLocalStorageSnapshot } from './helpers';

/**
 * Backup and restore settings for exporting and importing all local app data.
 */
export function BackupRestoreSection(): JSX.Element {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Exports all local HarborClient data to a `.hcb` backup file.
   */
  const handleExportBackup = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.api.exportBackup(collectLocalStorageSnapshot());
      if (result.canceled) return;
      toast.success('Backup exported');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Restores local HarborClient data from a `.hcb` backup file and relaunches the app.
   */
  const handleRestoreBackup = async (): Promise<void> => {
    const confirmed = await showConfirm(dispatch, {
      title: 'Restore backup?',
      message:
        'This replaces all local HarborClient data with the selected backup. Unsaved work in open tabs may be lost. The app will restart when restore completes.',
      confirmLabel: 'Restore',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const result = await window.api.importBackup();
      if (result.canceled) return;

      if (result.localStorage) {
        applyLocalStorageSnapshot(result.localStorage);
      }

      await window.api.restartApp();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const { label, icon } = settingsSectionMeta('backup-restore');
  const backupCatalog = sectionEntryBySection('backup-restore');

  return (
    <Page
      embedded
      title={label}
      icon={icon}
      description="Export everything HarborClient stores locally — collections, environments, settings, chats, credentials, and UI state — into a single backup file."
    >
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[18px] font-medium text-text">
            <SettingLabel settingId="backup-restore.actions">Backup & restore</SettingLabel>
          </span>
          <p className="hc-form-group-description m-0 text-[14px] text-muted mb-2">
            {backupCatalog.description}
          </p>
        </div>
        <div
          className="rounded-md border border-separator bg-sidebar px-4 py-3 mb-2 text-[16px] text-text"
          role="note"
        >
          <p className="m-0 mb-2 font-medium text-danger">Sensitive data warning</p>
          <p className="m-0 mb-2 text-muted">
            Backup files contain API keys, database passwords, proxy credentials, git tokens, and
            sharing private keys in readable form. Store backups securely and do not share them.
          </p>
          <p className="m-0 text-muted">
            Secrets protected by your operating system keychain may not decrypt when a backup is
            restored on a different machine or user account.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            aria-label="Export HarborClient backup"
            onClick={() => {
              void handleExportBackup();
            }}
          >
            Export backup
          </Button>
          <Button
            type="button"
            variant="primaryDanger"
            disabled={busy}
            aria-label="Restore HarborClient backup"
            onClick={() => {
              void handleRestoreBackup();
            }}
          >
            Restore from backup
          </Button>
        </div>

        {busy ? (
          <p role="status" aria-live="polite" className="mt-4 text-[14px] text-muted">
            Working…
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-[14px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Page>
  );
}
