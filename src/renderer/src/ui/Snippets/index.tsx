import { PageSidebar, SidebarLayout } from '@harborclient/sdk/components';
import { useCallback, useEffect, useLayoutEffect, useMemo, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  consumePendingSnippetMarketplaceSearch,
  selectPendingSnippetMarketplaceSearch
} from '#/renderer/src/store/slices/navigationSlice';
import { refreshSnippets } from '#/renderer/src/store/thunks/snippets';
import { usePersistedPageSidebarSection } from '#/renderer/src/hooks/usePersistedPageSidebarSection';
import { InstalledView } from './InstalledView';
import { InstallView } from './InstallView';
import { MarketplaceView } from './MarketplaceView';
import { useSnippetCatalog } from './hooks/useSnippetCatalog';
import { useSnippetDeepLinkInstall } from './hooks/useSnippetDeepLinkInstall';
import { useSnippetInstallActions } from './hooks/useSnippetInstallActions';
import { useSnippetPackageList } from './hooks/useSnippetPackageList';
import { openSnippetCatalogDetailTab } from './snippetTabHelpers';
import { SNIPPET_SECTIONS } from './sidebarConstants';
import type { SnippetsSidebarSection } from './sidebarTypes';

/**
 * Full-area snippet management with installed list, marketplace browse, and git install.
 */
export function Snippets(): JSX.Element {
  const dispatch = useAppDispatch();
  const pendingSnippetMarketplaceSearch = useAppSelector(selectPendingSnippetMarketplaceSearch);

  /**
   * Validates sidebar section ids for the Snippets tab.
   */
  const isValidSection = useCallback(
    (candidate: string): candidate is SnippetsSidebarSection =>
      SNIPPET_SECTIONS.some((entry) => entry.value === candidate),
    []
  );

  /**
   * Sidebar section queued by Search Anything until the marketplace search field applies it.
   */
  const navigationOverride = useMemo((): SnippetsSidebarSection | undefined => {
    if (pendingSnippetMarketplaceSearch != null) {
      return 'marketplace';
    }
    return undefined;
  }, [pendingSnippetMarketplaceSearch]);

  const { section, setSection } = usePersistedPageSidebarSection<SnippetsSidebarSection>({
    pageKey: 'snippets',
    defaultSection: 'installed',
    isValidSection,
    navigationOverride
  });

  const { installedPackages, refreshPackages } = useSnippetPackageList();
  const {
    catalog,
    setCatalog,
    catalogLoading,
    setCatalogLoading,
    catalogError,
    setCatalogError,
    catalogSearchQuery,
    setCatalogSearchQuery,
    catalogCategoryFilter,
    setCatalogCategoryFilter,
    filteredCatalogSnippets,
    loadCatalog,
    resetCatalogFilters
  } = useSnippetCatalog();

  /**
   * Reloads snippets and installed package summaries after marketplace mutations.
   */
  const refreshAll = useCallback(async (): Promise<void> => {
    await Promise.all([refreshPackages(), dispatch(refreshSnippets()).unwrap()]);
  }, [dispatch, refreshPackages]);

  const {
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
    handleUpdatePackage,
    handleUninstallPackage
  } = useSnippetInstallActions({ refresh: refreshAll });

  useSnippetDeepLinkInstall({
    setSection,
    setCatalog,
    setCatalogLoading,
    setCatalogError,
    setActionBusyId,
    openCatalogDetail: (entry) => openSnippetCatalogDetailTab(dispatch, entry),
    refresh: refreshAll
  });

  /**
   * Applies a marketplace search query queued by global search navigation before paint.
   */
  useLayoutEffect(() => {
    if (pendingSnippetMarketplaceSearch == null) {
      return;
    }
    setCatalogSearchQuery(pendingSnippetMarketplaceSearch);
    setSection('marketplace');
  }, [pendingSnippetMarketplaceSearch, setCatalogSearchQuery, setSection]);

  /**
   * Loads marketplace catalog data when the section is restored from memory or navigation.
   */
  useEffect(() => {
    if (section === 'marketplace' && catalog == null && !catalogLoading) {
      void loadCatalog();
    }
  }, [section, catalog, catalogLoading, loadCatalog]);

  /**
   * Clears marketplace search navigation after the query is applied locally.
   */
  useEffect(() => {
    if (pendingSnippetMarketplaceSearch == null) {
      return;
    }
    if (catalogSearchQuery.trim() !== pendingSnippetMarketplaceSearch.trim()) {
      return;
    }
    dispatch(consumePendingSnippetMarketplaceSearch());
  }, [catalogSearchQuery, dispatch, pendingSnippetMarketplaceSearch]);

  /**
   * Clears marketplace filters when leaving the Marketplace section and loads
   * section-specific data when entering Marketplace.
   *
   * @param next - Sidebar section to show.
   */
  const handleSectionChange = (next: SnippetsSidebarSection): void => {
    if (section === 'marketplace' && next !== 'marketplace') {
      resetCatalogFilters();
    }
    setSection(next);
    if (next === 'marketplace' && catalog == null && !catalogLoading) {
      void loadCatalog();
    }
  };

  return (
    <>
      <SidebarLayout
        sidebar={
          <PageSidebar
            ariaLabel="Snippet sections"
            selected={section}
            onSelect={handleSectionChange}
            items={SNIPPET_SECTIONS}
          />
        }
      >
        {section === 'installed' ? (
          <InstalledView
            installedPackages={installedPackages}
            actionBusyId={actionBusyId}
            refreshPackages={refreshPackages}
            onUpdatePackage={(catalogId) => void handleUpdatePackage(catalogId)}
            onUninstallPackage={(catalogId) => void handleUninstallPackage(catalogId)}
          />
        ) : null}
        {section === 'marketplace' ? (
          <MarketplaceView
            catalogLoading={catalogLoading}
            catalogError={catalogError}
            catalogSearchQuery={catalogSearchQuery}
            catalogCategoryFilter={catalogCategoryFilter}
            filteredCatalogSnippets={filteredCatalogSnippets}
            onSearchChange={setCatalogSearchQuery}
            onCategoryChange={(category) =>
              setCatalogCategoryFilter(category as typeof catalogCategoryFilter)
            }
            onOpenCatalogDetail={(entry) => openSnippetCatalogDetailTab(dispatch, entry)}
            onRetryLoad={() => void loadCatalog()}
          />
        ) : null}
        {section === 'install' ? (
          <InstallView
            gitInstallUrl={gitInstallUrl}
            gitInstallRef={gitInstallRef}
            gitInstallError={gitInstallError}
            gitInstallBusy={gitInstallBusy}
            fileInstallBusy={fileInstallBusy}
            directoryInstallBusy={directoryInstallBusy}
            onGitInstallUrlChange={setGitInstallUrl}
            onGitInstallRefChange={setGitInstallRef}
            onInstallFromGit={() => void handleInstallFromGit()}
            onInstallFromFile={() => void handleInstallFromFile()}
            onLoadUnpacked={() => void handleLoadUnpacked()}
          />
        ) : null}
      </SidebarLayout>
    </>
  );
}
