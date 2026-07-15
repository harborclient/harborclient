import { useEffect, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { SnippetCatalog, SnippetCatalogEntry } from '#/shared/snippet/catalog';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  consumePendingSnippetInstall,
  selectPendingSnippetInstallId
} from '#/renderer/src/store/slices/navigationSlice';
import {
  showAlert,
  showConfirm,
  formatIpcErrorMessage
} from '#/renderer/src/ui/Modals/dialogHelpers';
import { resolvePendingSnippetInstallDeepLink } from '../helpers';
import type { SnippetsSidebarSection } from '../sidebarTypes';

interface UseSnippetDeepLinkInstallArgs {
  /**
   * Switches the active sidebar section.
   */
  setSection: (section: SnippetsSidebarSection) => void;

  /**
   * Replaces the loaded marketplace catalog.
   */
  setCatalog: Dispatch<SetStateAction<SnippetCatalog | null>>;

  /**
   * Sets marketplace catalog loading state.
   */
  setCatalogLoading: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets marketplace catalog error state.
   */
  setCatalogError: Dispatch<SetStateAction<string | null>>;

  /**
   * Sets the catalog action busy id during deep-link installs.
   */
  setActionBusyId: Dispatch<SetStateAction<string | null>>;

  /**
   * Opens the marketplace snippet detail modal.
   */
  openCatalogDetail: (entry: SnippetCatalogEntry) => void;

  /**
   * Reloads snippets and installed package summaries after a successful install.
   */
  refresh: () => Promise<void>;
}

/**
 * Handles harborclient:// snippet install deep links queued in navigation state.
 */
export function useSnippetDeepLinkInstall({
  setSection,
  setCatalog,
  setCatalogLoading,
  setCatalogError,
  setActionBusyId,
  openCatalogDetail,
  refresh
}: UseSnippetDeepLinkInstallArgs): void {
  const dispatch = useAppDispatch();
  const pendingSnippetInstallId = useAppSelector(selectPendingSnippetInstallId);

  /**
   * Resolves a queued marketplace install deep link against the snippet catalog.
   */
  useEffect(() => {
    if (!pendingSnippetInstallId) {
      return;
    }

    const snippetId = pendingSnippetInstallId;
    let cancelled = false;

    const run = async (): Promise<void> => {
      setSection('marketplace');
      setCatalogLoading(true);
      setCatalogError(null);

      const result = await resolvePendingSnippetInstallDeepLink(snippetId, {
        getSnippetCatalog: async () => {
          const loaded = await window.api.getSnippetCatalog();
          if (!cancelled) {
            setCatalog(loaded);
          }
          return loaded;
        },
        listInstalledPackages: () => window.api.listInstalledSnippetPackages(),
        confirmInstall: (entry) =>
          showConfirm(dispatch, {
            title: `Install ${entry.name}?`,
            message: `Install ${entry.name} v${entry.version} by ${entry.author} from ${entry.repoUrl}?`,
            confirmLabel: 'Install'
          }),
        installFromGit: async (entry) => {
          setActionBusyId(entry.id);
          try {
            return await window.api.installSnippetFromGit(entry.repoUrl, entry.ref);
          } finally {
            if (!cancelled) {
              setActionBusyId(null);
            }
          }
        },
        isCancelled: () => cancelled
      });

      if (cancelled) {
        return;
      }

      setCatalogLoading(false);
      dispatch(consumePendingSnippetInstall());

      switch (result.kind) {
        case 'catalog-error':
          showAlert(
            dispatch,
            formatIpcErrorMessage(
              new Error(result.message),
              'Could not load the snippet marketplace.'
            ),
            'Marketplace unavailable'
          );
          break;
        case 'not-found':
          showAlert(
            dispatch,
            `Snippet bundle "${snippetId}" was not found in the marketplace catalog.`,
            'Snippet bundle not found'
          );
          break;
        case 'already-installed': {
          const catalogEntry = (await window.api.getSnippetCatalog()).snippets.find(
            (candidate) => candidate.id === snippetId
          );
          if (catalogEntry) {
            openCatalogDetail(catalogEntry);
          } else {
            setSection('installed');
          }
          break;
        }
        case 'installed':
          toast.success(`Installed ${result.package.name}`);
          await refresh();
          setSection('installed');
          break;
        case 'install-error':
          showAlert(
            dispatch,
            formatIpcErrorMessage(
              new Error(result.message),
              'The snippet bundle could not be installed.'
            ),
            'Install failed',
            { icon: 'warning' }
          );
          break;
        case 'declined':
        case 'cancelled':
          break;
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    pendingSnippetInstallId,
    dispatch,
    setSection,
    setCatalog,
    setCatalogLoading,
    setCatalogError,
    setActionBusyId,
    openCatalogDetail,
    refresh
  ]);
}
