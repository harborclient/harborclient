import { useCallback, useState } from 'react';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import type { SnippetGitPreview } from '#/shared/snippet/types';

interface UseSnippetCatalogDetailResult {
  catalogDetailEntry: SnippetCatalogEntry | null;
  catalogPreview: SnippetGitPreview | null;
  catalogPreviewLoadState: 'idle' | 'loading' | 'loaded' | 'error';
  catalogPreviewError: string | null;
  openCatalogDetail: (entry: SnippetCatalogEntry) => void;
  closeCatalogDetail: () => void;
  resetCatalogDetail: () => void;
}

/**
 * Manages marketplace detail modal state and remote git preview loading.
 */
export function useSnippetCatalogDetail(): UseSnippetCatalogDetailResult {
  const [catalogDetailEntry, setCatalogDetailEntry] = useState<SnippetCatalogEntry | null>(null);
  const [catalogPreview, setCatalogPreview] = useState<SnippetGitPreview | null>(null);
  const [catalogPreviewLoadState, setCatalogPreviewLoadState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [catalogPreviewError, setCatalogPreviewError] = useState<string | null>(null);

  /**
   * Opens the marketplace detail modal and fetches a git preview for the listing.
   *
   * @param entry - Marketplace listing to inspect.
   */
  const openCatalogDetail = useCallback((entry: SnippetCatalogEntry): void => {
    setCatalogDetailEntry(entry);
    setCatalogPreview(null);
    setCatalogPreviewError(null);
    setCatalogPreviewLoadState('loading');

    void window.api
      .previewSnippetFromGit(entry.repoUrl, entry.ref)
      .then((preview) => {
        setCatalogPreview(preview);
        setCatalogPreviewLoadState('loaded');
      })
      .catch((err: unknown) => {
        setCatalogPreviewError(err instanceof Error ? err.message : String(err));
        setCatalogPreviewLoadState('error');
      });
  }, []);

  /**
   * Closes the marketplace detail modal and clears preview state.
   */
  const closeCatalogDetail = useCallback((): void => {
    setCatalogDetailEntry(null);
    setCatalogPreview(null);
    setCatalogPreviewError(null);
    setCatalogPreviewLoadState('idle');
  }, []);

  /**
   * Resets marketplace detail modal state when leaving the Marketplace section.
   */
  const resetCatalogDetail = useCallback((): void => {
    closeCatalogDetail();
  }, [closeCatalogDetail]);

  return {
    catalogDetailEntry,
    catalogPreview,
    catalogPreviewLoadState,
    catalogPreviewError,
    openCatalogDetail,
    closeCatalogDetail,
    resetCatalogDetail
  };
}
