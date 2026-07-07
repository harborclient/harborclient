import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import type { InstalledSnippetPackage } from '#/shared/snippet/types';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { showAlert, formatIpcErrorMessage } from '#/renderer/src/ui/modals/dialogHelpers';

interface UseSnippetInstallActionsArgs {
  /**
   * Reloads snippets and installed package summaries after marketplace mutations.
   */
  refresh: () => Promise<void>;
}

interface UseSnippetInstallActionsResult {
  gitInstallUrl: string;
  gitInstallRef: string;
  gitInstallError: string | null;
  gitInstallBusy: boolean;
  fileInstallBusy: boolean;
  directoryInstallBusy: boolean;
  actionBusyId: string | null;
  setActionBusyId: Dispatch<SetStateAction<string | null>>;
  setGitInstallUrl: (url: string) => void;
  setGitInstallRef: (ref: string) => void;
  handleInstallFromGit: () => Promise<void>;
  handleInstallFromFile: () => Promise<void>;
  handleLoadUnpacked: () => Promise<void>;
  handleInstallCatalogEntry: (entry: SnippetCatalogEntry) => Promise<void>;
  handleUpdatePackage: (catalogId: string) => Promise<void>;
  handleUninstallPackage: (catalogId: string) => Promise<void>;
}

/**
 * Manages snippet marketplace install, update, and uninstall actions.
 */
export function useSnippetInstallActions({
  refresh
}: UseSnippetInstallActionsArgs): UseSnippetInstallActionsResult {
  const dispatch = useAppDispatch();
  const [gitInstallUrl, setGitInstallUrl] = useState('');
  const [gitInstallRef, setGitInstallRef] = useState('');
  const [gitInstallError, setGitInstallError] = useState<string | null>(null);
  const [gitInstallBusy, setGitInstallBusy] = useState(false);
  const [fileInstallBusy, setFileInstallBusy] = useState(false);
  const [directoryInstallBusy, setDirectoryInstallBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  /**
   * Installs a snippet bundle from the git install form.
   */
  const handleInstallFromGit = useCallback(async (): Promise<void> => {
    const url = gitInstallUrl.trim();
    if (!url) {
      setGitInstallError('Repository URL is required.');
      return;
    }

    setGitInstallBusy(true);
    setGitInstallError(null);
    try {
      await window.api.installSnippetFromGit(url, gitInstallRef.trim() || undefined);
      toast.success('Snippet bundle installed');
      setGitInstallUrl('');
      setGitInstallRef('');
      await refresh();
    } catch (err) {
      const message = formatIpcErrorMessage(err, 'Failed to install snippet bundle');
      setGitInstallError(message);
      showAlert(dispatch, message);
    } finally {
      setGitInstallBusy(false);
    }
  }, [dispatch, gitInstallRef, gitInstallUrl, refresh]);

  /**
   * Installs a snippet bundle from a `.hcs` or `.zip` package file.
   */
  const handleInstallFromFile = useCallback(async (): Promise<void> => {
    setFileInstallBusy(true);
    try {
      const installed = await window.api.installSnippet();
      if (!installed) {
        return;
      }

      toast.success(`Installed ${installed.name}`);
      await refresh();
    } catch (err) {
      showAlert(dispatch, formatIpcErrorMessage(err, 'Failed to install snippet bundle'));
    } finally {
      setFileInstallBusy(false);
    }
  }, [dispatch, refresh]);

  /**
   * Imports a snippet bundle from an unpacked directory on disk.
   */
  const handleLoadUnpacked = useCallback(async (): Promise<void> => {
    setDirectoryInstallBusy(true);
    try {
      const installed = await window.api.loadUnpackedSnippet();
      if (!installed) {
        return;
      }

      toast.success(`Installed ${installed.name}`);
      await refresh();
    } catch (err) {
      showAlert(dispatch, formatIpcErrorMessage(err, 'Failed to load snippet bundle'));
    } finally {
      setDirectoryInstallBusy(false);
    }
  }, [dispatch, refresh]);

  /**
   * Installs one marketplace catalog entry from its repository URL.
   *
   * @param entry - Marketplace listing to install.
   */
  const handleInstallCatalogEntry = useCallback(
    async (entry: SnippetCatalogEntry): Promise<void> => {
      setActionBusyId(entry.id);
      try {
        await window.api.installSnippetFromGit(entry.repoUrl, entry.ref);
        toast.success(`Installed ${entry.name}`);
        await refresh();
      } catch (err) {
        showAlert(dispatch, formatIpcErrorMessage(err, `Failed to install ${entry.name}`));
      } finally {
        setActionBusyId(null);
      }
    },
    [dispatch, refresh]
  );

  /**
   * Updates one installed snippet bundle from its stored git origin.
   *
   * @param catalogId - Snippet bundle id from snippets.json.
   */
  const handleUpdatePackage = useCallback(
    async (catalogId: string): Promise<void> => {
      setActionBusyId(catalogId);
      try {
        const updated: InstalledSnippetPackage = await window.api.updateSnippetFromGit(catalogId);
        toast.success(`Updated ${updated.name}`);
        await refresh();
      } catch (err) {
        showAlert(dispatch, formatIpcErrorMessage(err, 'Failed to update snippet bundle'));
      } finally {
        setActionBusyId(null);
      }
    },
    [dispatch, refresh]
  );

  /**
   * Uninstalls one marketplace snippet bundle.
   *
   * @param catalogId - Snippet bundle id from snippets.json.
   */
  const handleUninstallPackage = useCallback(
    async (catalogId: string): Promise<void> => {
      setActionBusyId(catalogId);
      try {
        await window.api.uninstallSnippetPackage(catalogId);
        toast.success('Snippet bundle removed');
        await refresh();
      } catch (err) {
        showAlert(dispatch, formatIpcErrorMessage(err, 'Failed to uninstall snippet bundle'));
      } finally {
        setActionBusyId(null);
      }
    },
    [dispatch, refresh]
  );

  return {
    gitInstallUrl,
    gitInstallRef,
    gitInstallError,
    gitInstallBusy,
    fileInstallBusy,
    directoryInstallBusy,
    actionBusyId,
    setActionBusyId,
    setGitInstallUrl,
    setGitInstallRef,
    handleInstallFromGit,
    handleInstallFromFile,
    handleLoadUnpacked,
    handleInstallCatalogEntry,
    handleUpdatePackage,
    handleUninstallPackage
  };
}
