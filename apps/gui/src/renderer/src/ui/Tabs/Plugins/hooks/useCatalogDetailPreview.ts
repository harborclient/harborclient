import { useCallback, useEffect, useState } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo, PluginGitPreview } from '#/shared/plugin/types';
import { findInstalledCatalogPlugin } from '../helpers';

interface UseCatalogDetailPreviewArgs {
  /**
   * Installed plugin rows from the main process.
   */
  plugins: PluginInfo[];

  /**
   * Opens the installed plugin detail modal.
   */
  openDetail: (plugin: PluginInfo) => void;

  /**
   * Clears catalog error state before opening a listing.
   */
  setCatalogError: (error: string | null) => void;
}

interface UseCatalogDetailPreviewResult {
  /**
   * Catalog listing currently shown in the marketplace detail modal, if any.
   */
  catalogDetailEntry: PluginCatalogEntry | null;

  /**
   * Remote manifest preview for the open catalog listing.
   */
  catalogPreview: PluginGitPreview | null;

  /**
   * Load state for the catalog manifest preview.
   */
  catalogPreviewLoadState: 'idle' | 'loading' | 'loaded' | 'error';

  /**
   * Preview fetch error message, if any.
   */
  catalogPreviewError: string | null;

  /**
   * Opens the marketplace detail modal for one catalog listing.
   */
  openCatalogDetail: (entry: PluginCatalogEntry) => void;

  /**
   * Closes the marketplace detail modal.
   */
  closeCatalogDetail: () => void;

  /**
   * Clears catalog detail modal state when leaving the Marketplace section.
   */
  resetCatalogDetail: () => void;

  /**
   * Closes the catalog detail modal after a successful install.
   */
  closeCatalogDetailAfterInstall: () => void;
}

/**
 * Manages marketplace catalog detail modal state and remote manifest preview loading.
 */
export function useCatalogDetailPreview({
  plugins,
  openDetail,
  setCatalogError
}: UseCatalogDetailPreviewArgs): UseCatalogDetailPreviewResult {
  const [catalogDetailEntry, setCatalogDetailEntry] = useState<PluginCatalogEntry | null>(null);
  const [catalogPreview, setCatalogPreview] = useState<PluginGitPreview | null>(null);
  const [catalogPreviewLoadState, setCatalogPreviewLoadState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [catalogPreviewError, setCatalogPreviewError] = useState<string | null>(null);

  /**
   * Closes the marketplace detail modal.
   */
  const closeCatalogDetail = useCallback((): void => {
    setCatalogDetailEntry(null);
    setCatalogPreview(null);
    setCatalogPreviewLoadState('idle');
    setCatalogPreviewError(null);
    setCatalogError(null);
  }, [setCatalogError]);

  /**
   * Clears catalog detail modal state when leaving the Marketplace section.
   */
  const resetCatalogDetail = useCallback((): void => {
    setCatalogDetailEntry(null);
    setCatalogPreview(null);
    setCatalogPreviewLoadState('idle');
    setCatalogPreviewError(null);
  }, []);

  /**
   * Closes the catalog detail modal after a successful install.
   */
  const closeCatalogDetailAfterInstall = useCallback((): void => {
    setCatalogDetailEntry(null);
  }, []);

  /**
   * Opens the marketplace detail modal for one catalog listing.
   *
   * @param entry - Catalog row to inspect.
   */
  const openCatalogDetail = useCallback(
    (entry: PluginCatalogEntry): void => {
      const installed = findInstalledCatalogPlugin(plugins, entry.id);
      if (installed) {
        openDetail(installed);
        return;
      }
      setCatalogError(null);
      setCatalogPreview(null);
      setCatalogPreviewLoadState('loading');
      setCatalogPreviewError(null);
      setCatalogDetailEntry(entry);
    },
    [plugins, openDetail, setCatalogError]
  );

  /**
   * Fetches remote manifest preview data when a marketplace detail modal opens.
   */
  useEffect(() => {
    let active = true;
    if (!catalogDetailEntry) {
      return () => {
        active = false;
      };
    }

    void window.api
      .previewPluginFromGit(catalogDetailEntry.repoUrl, catalogDetailEntry.ref)
      .then((preview) => {
        if (active) {
          setCatalogPreview(preview);
          setCatalogPreviewLoadState('loaded');
        }
      })
      .catch((err) => {
        if (active) {
          setCatalogPreview(null);
          setCatalogPreviewLoadState('error');
          setCatalogPreviewError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      active = false;
    };
  }, [catalogDetailEntry]);

  return {
    catalogDetailEntry,
    catalogPreview,
    catalogPreviewLoadState,
    catalogPreviewError,
    openCatalogDetail,
    closeCatalogDetail,
    resetCatalogDetail,
    closeCatalogDetailAfterInstall
  };
}
