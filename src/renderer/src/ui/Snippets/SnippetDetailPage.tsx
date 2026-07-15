import { Button, Page, Spinner } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, type JSX } from 'react';
import type { PageRef } from '#/renderer/src/store/drafts';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { refreshSnippets } from '#/renderer/src/store/thunks/snippets';
import { faCode } from '#/renderer/src/fontawesome';
import { showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/Shared/classes';
import { SnippetDetailContent } from './SnippetDetailContent';
import { useSnippetCatalog } from './hooks/useSnippetCatalog';
import { useSnippetCatalogDetail } from './hooks/useSnippetCatalogDetail';
import { useSnippetInstallActions } from './hooks/useSnippetInstallActions';
import { useSnippetPackageList } from './hooks/useSnippetPackageList';

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
  const { installedPackages, packagesLoading, refreshPackages } = useSnippetPackageList();
  const {
    catalogDetailEntry,
    catalogPreview,
    catalogPreviewLoadState,
    catalogPreviewError,
    openCatalogDetail
  } = useSnippetCatalogDetail();

  /**
   * Closes this detail tab.
   */
  const handleCloseTab = useCallback((): void => {
    dispatch(closeTab(tabId));
  }, [dispatch, tabId]);

  /**
   * Reloads snippets and installed package summaries after marketplace mutations.
   */
  const refreshAll = useCallback(async (): Promise<void> => {
    await Promise.all([refreshPackages(), dispatch(refreshSnippets()).unwrap()]);
  }, [dispatch, refreshPackages]);

  const { actionBusyId, handleInstallCatalogEntry, handleUpdatePackage, handleUninstallPackage } =
    useSnippetInstallActions({
      refresh: refreshAll
    });

  const installedPackage = useMemo(
    () => installedPackages.find((pkg) => pkg.catalogId === page.catalogId),
    [installedPackages, page.catalogId]
  );

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
   * Closes the tab when the listing cannot be resolved and the bundle is not installed locally.
   */
  useEffect(() => {
    if (catalogLoading || packagesLoading) {
      return;
    }
    if (installedPackage) {
      return;
    }
    if (catalogById.size > 0 && !catalogById.has(page.catalogId)) {
      dispatch(closeTab(tabId));
    }
  }, [
    page.catalogId,
    catalogById,
    catalogLoading,
    installedPackage,
    packagesLoading,
    dispatch,
    tabId
  ]);

  const entry = catalogById.get(page.catalogId) ?? catalogDetailEntry;
  const isLoading = (catalogLoading || packagesLoading) && !entry && !installedPackage;

  /**
   * Uninstalls the open bundle after confirmation and closes this tab on success.
   */
  const handleUninstallInstalledPackage = async (): Promise<void> => {
    if (!installedPackage) {
      return;
    }

    const snippetLabel = installedPackage.snippetCount === 1 ? 'snippet' : 'snippets';
    const confirmed = await showConfirm(dispatch, {
      title: 'Uninstall snippet bundle',
      message: `Uninstall "${installedPackage.name}"? This removes ${installedPackage.snippetCount} imported ${snippetLabel} from your library.`,
      confirmLabel: 'Uninstall',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    const succeeded = await handleUninstallPackage(installedPackage.catalogId);
    if (succeeded) {
      handleCloseTab();
    }
  };

  const headerActions = installedPackage ? (
    <div className="flex shrink-0 items-center gap-2">
      {installedPackage.installSource == null || installedPackage.installSource === 'git' ? (
        <Button
          type="button"
          variant="toolbar"
          disabled={actionBusyId === installedPackage.catalogId}
          onClick={() => void handleUpdatePackage(installedPackage.catalogId)}
        >
          Update
        </Button>
      ) : null}
      <Button
        type="button"
        variant="toolbar"
        className={toolbarDangerButtonClass}
        disabled={actionBusyId === installedPackage.catalogId}
        onClick={() => void handleUninstallInstalledPackage()}
      >
        Uninstall
      </Button>
    </div>
  ) : entry ? (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        disabled={actionBusyId === entry.id}
        onClick={() => void handleInstallCatalogEntry(entry)}
      >
        {actionBusyId === entry.id ? 'Installing…' : 'Install'}
      </Button>
    </div>
  ) : undefined;

  return (
    <Page
      embedded
      title={page.label}
      icon={faCode}
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
      actions={headerActions}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted" role="status">
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
