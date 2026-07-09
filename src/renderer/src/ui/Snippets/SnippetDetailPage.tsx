import { Button, Page, Spinner } from '@harborclient/sdk/components';
import { useEffect, type JSX } from 'react';
import type { PageRef } from '#/renderer/src/store/drafts';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { refreshSnippets } from '#/renderer/src/store/thunks/snippets';
import { faTerminal } from '#/renderer/src/fontawesome';
import { SnippetDetailContent } from './SnippetDetailContent';
import { useSnippetCatalog } from './hooks/useSnippetCatalog';
import { useSnippetCatalogDetail } from './hooks/useSnippetCatalogDetail';
import { useSnippetInstallActions } from './hooks/useSnippetInstallActions';

interface Props {
  /**
   * Marketplace snippet bundle detail tab identity.
   */
  page: Extract<PageRef, { type: 'snippet-detail' }>;

  /**
   * Tab id hosting this page.
   */
  tabId: string;
}

/**
 * Renders a marketplace snippet bundle detail view inside a page tab.
 */
export function SnippetDetailPage({ page, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { catalogById, catalogLoading, loadCatalog } = useSnippetCatalog();
  const {
    catalogDetailEntry,
    catalogPreview,
    catalogPreviewLoadState,
    catalogPreviewError,
    openCatalogDetail
  } = useSnippetCatalogDetail();

  /**
   * Reloads snippets and installed package summaries after marketplace mutations.
   */
  const refreshAll = async (): Promise<void> => {
    await dispatch(refreshSnippets()).unwrap();
  };

  const { actionBusyId, handleInstallCatalogEntry } = useSnippetInstallActions({
    refresh: refreshAll
  });

  /**
   * Loads marketplace catalog data when this tab opens.
   */
  useEffect(() => {
    if (catalogById.size === 0 && !catalogLoading) {
      void loadCatalog();
    }
  }, [catalogById.size, catalogLoading, loadCatalog]);

  /**
   * Opens marketplace preview state when the catalog listing is available.
   */
  useEffect(() => {
    const entry = catalogById.get(page.catalogId);
    if (entry) {
      openCatalogDetail(entry);
    }
  }, [page.catalogId, catalogById, openCatalogDetail]);

  /**
   * Closes the tab when the marketplace listing cannot be resolved after catalog load.
   */
  useEffect(() => {
    if (catalogLoading) {
      return;
    }
    if (catalogById.size > 0 && !catalogById.has(page.catalogId)) {
      dispatch(closeTab(tabId));
    }
  }, [page.catalogId, catalogById, catalogLoading, dispatch, tabId]);

  const entry = catalogById.get(page.catalogId) ?? catalogDetailEntry;
  const isLoading = catalogLoading && !entry;

  return (
    <Page
      embedded
      title={page.label}
      icon={faTerminal}
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
      actions={
        entry ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              disabled={actionBusyId === entry.id}
              onClick={() => void handleInstallCatalogEntry(entry)}
            >
              {actionBusyId === entry.id ? 'Installing…' : 'Install'}
            </Button>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-[16px] text-muted" role="status">
          <Spinner size="sm" />
          <span>Loading…</span>
        </div>
      ) : entry ? (
        <SnippetDetailContent
          entry={entry}
          preview={catalogPreview}
          previewLoadState={catalogPreviewLoadState}
          previewError={catalogPreviewError}
        />
      ) : null}
    </Page>
  );
}
