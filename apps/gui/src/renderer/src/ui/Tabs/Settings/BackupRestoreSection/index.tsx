import {
  Button,
  FormGroup,
  Input,
  Page,
  SettingSectionHeading
} from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';

import { useAppDispatch } from '#/renderer/src/store/hooks';
import { showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';
import { entryById, sectionEntryBySection } from '../catalog/catalog';
import { settingsSectionMeta } from '../constants';
import { settingAnchorId } from '../settingAnchorId';
import type { SettingsSectionComponentProps } from '../catalog/registry';
import { ConfirmationsTable } from './ConfirmationsTable';
import { applyLocalStorageSnapshot, collectLocalStorageSnapshot } from './helpers';

const CONFIRMATIONS_GROUP_ID = 'backup-restore.confirmations';
const DATA_DIRECTORY_INPUT_ID = 'backup-restore-data-directory';

/**
 * Backup and restore settings for exporting and importing all local app data.
 */
export function BackupRestoreSection({
  focusSettingId,
  onFocusSettingHandled
}: SettingsSectionComponentProps): JSX.Element {
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataDirectoryPath, setDataDirectoryPath] = useState('');

  /**
   * Loads the Electron userData path shown at the bottom of this settings page.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.getUserDataPath().then((path) => {
      if (!cancelled) {
        setDataDirectoryPath(path);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Scrolls the confirmations group into view when opened from settings or global search.
   */
  useEffect(() => {
    if (focusSettingId !== CONFIRMATIONS_GROUP_ID) {
      return;
    }

    requestAnimationFrame(() => {
      document.getElementById(settingAnchorId(CONFIRMATIONS_GROUP_ID))?.scrollIntoView({
        block: 'start'
      });
      onFocusSettingHandled?.();
    });
  }, [focusSettingId, onFocusSettingHandled]);

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

  /**
   * Opens the data directory in the OS default file browser.
   */
  const handleOpenDataDirectory = async (): Promise<void> => {
    if (!dataDirectoryPath) return;

    try {
      await window.api.openPath(dataDirectoryPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const { label, icon } = settingsSectionMeta('backup-restore');
  const backupCatalog = sectionEntryBySection('backup-restore');
  const confirmationsCatalog = entryById(CONFIRMATIONS_GROUP_ID);

  return (
    <Page
      embedded
      title={label}
      icon={icon}
      description="Export everything HarborClient stores locally — collections, environments, settings, chats, credentials, and UI state — into a single backup file."
    >
      <div className="mb-6 flex flex-col gap-3">
        <SettingSectionHeading
          settingId="backup-restore.actions"
          title="Backup & restore"
          description={backupCatalog.description}
          className="flex flex-col gap-1"
          descriptionClassName="hc-form-group-description m-0 text-[14px] text-muted mb-2"
        />
        <div
          className="rounded-md border border-separator bg-sidebar px-4 py-3 mb-2 text-text"
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

      <div
        id={settingAnchorId(CONFIRMATIONS_GROUP_ID)}
        className="mb-6 flex flex-col gap-3 scroll-mt-4"
      >
        <SettingSectionHeading
          settingId={CONFIRMATIONS_GROUP_ID}
          title={confirmationsCatalog.label}
          description={confirmationsCatalog.description}
          className="flex flex-col gap-1"
          descriptionClassName="hc-form-group-description m-0 text-[14px] text-muted mb-2"
        />
        <ConfirmationsTable />
      </div>

      <FormGroup
        label="Data directory"
        description="HarborClient stores local databases, settings, and other on-disk data in this folder."
        htmlFor={DATA_DIRECTORY_INPUT_ID}
      >
        <div className="flex gap-2">
          <Input
            id={DATA_DIRECTORY_INPUT_ID}
            type="text"
            className="min-w-0 flex-1"
            value={dataDirectoryPath}
            readOnly
            aria-label="Data directory"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!dataDirectoryPath}
            aria-label="Open data directory in file browser"
            onClick={() => {
              void handleOpenDataDirectory();
            }}
          >
            Open
          </Button>
        </div>
      </FormGroup>
    </Page>
  );
}
