import {
  AsyncListState,
  Button,
  FaIcon,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import { Fragment, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { Snippet } from '#/shared/types';
import type { InstalledSnippetPackage } from '#/shared/snippet/types';
import { snippetScopeLabel } from '#/shared/snippetScope';
import {
  faChevronDown,
  faChevronRight,
  faFileImport,
  faPlus,
  faTerminal
} from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { deleteSnippet, refreshSnippets } from '#/renderer/src/store/thunks/snippets';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { providerOptionLabel, useProviders } from '#/renderer/src/hooks/useProviders';
import { CodePreviewTooltip } from '#/renderer/src/ui/shared/CodePreviewTooltip';
import { createImportedSnippetDraft } from '#/renderer/src/ui/shared/snippetEditDraft';
import { openSnippetCatalogDetailTab, openSnippetEditTab } from './snippetTabHelpers';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/shared/classes';
import { VerifiedPublisherBadge } from '#/renderer/src/ui/shared/VerifiedPublisherBadge';

interface Props {
  /**
   * Installed marketplace bundle summaries for update/uninstall actions.
   */
  installedPackages: InstalledSnippetPackage[];

  /**
   * Whether a package action is in progress.
   */
  actionBusyId: string | null;

  /**
   * Reloads installed marketplace bundle summaries after per-snippet deletes.
   */
  refreshPackages: () => Promise<InstalledSnippetPackage[]>;

  /**
   * Updates one installed marketplace bundle.
   */
  onUpdatePackage: (catalogId: string) => void;

  /**
   * Uninstalls one marketplace bundle.
   */
  onUninstallPackage: (catalogId: string) => void;
}

/**
 * Installed snippets list with local create/import and marketplace bundle actions.
 */
export function InstalledView({
  installedPackages,
  actionBusyId,
  refreshPackages,
  onUpdatePackage,
  onUninstallPackage
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const snippets = useAppSelector(selectSnippets);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedCatalogIds, setExpandedCatalogIds] = useState<Set<string>>(new Set());

  const { providers } = useProviders([]);

  /**
   * Resolves storage location labels for routed snippet rows.
   */
  const providerLabelById = useMemo(
    () =>
      new Map(
        providers.map((provider) => [
          provider.id,
          `${provider.name || 'Untitled'} (${providerOptionLabel(provider)})`
        ])
      ),
    [providers]
  );

  /**
   * Groups snippet rows by the marketplace bundle they were imported from, so each
   * installed bundle row can expand to show its own snippets.
   */
  const snippetsByCatalogId = useMemo(() => {
    const map = new Map<string, Snippet[]>();
    for (const snippet of snippets) {
      if (!snippet.catalogId) {
        continue;
      }
      const list = map.get(snippet.catalogId) ?? [];
      list.push(snippet);
      map.set(snippet.catalogId, list);
    }
    return map;
  }, [snippets]);

  /**
   * Snippet rows owned by the user rather than a marketplace bundle, for the flat
   * "Custom snippets" list (bundle members are shown under their package group above).
   */
  const standaloneSnippets = useMemo(
    () => snippets.filter((snippet) => !snippet.catalogId),
    [snippets]
  );

  /**
   * Toggles whether one installed bundle's snippet list is expanded.
   *
   * @param catalogId - Bundle id whose expansion state should flip.
   */
  const toggleBundleExpanded = (catalogId: string): void => {
    setExpandedCatalogIds((prev) => {
      const next = new Set(prev);
      if (next.has(catalogId)) {
        next.delete(catalogId);
      } else {
        next.add(catalogId);
      }
      return next;
    });
  };

  /**
   * Loads snippets when the installed section opens.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Fetches snippets and bundle summaries when the installed section opens.
     */
    const load = async (): Promise<void> => {
      setLoading(true);
      setLoadError(null);
      try {
        await Promise.all([dispatch(refreshSnippets()).unwrap(), refreshPackages()]);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load snippets');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [dispatch, refreshPackages]);

  /**
   * Opens the create snippet tab with a blank draft.
   */
  const handleAdd = (): void => {
    openSnippetEditTab(dispatch, { mode: 'new', label: 'New snippet' });
  };

  /**
   * Reads a `.js` file and opens the create tab with imported source.
   */
  const handleImport = async (): Promise<void> => {
    try {
      const result = await window.api.importSnippetFile();
      if (!result) {
        return;
      }

      openSnippetEditTab(dispatch, {
        mode: 'import',
        seedCode: result.code,
        label: createImportedSnippetDraft(result.code).name
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import snippet');
    }
  };

  /**
   * Opens the edit tab for a local snippet or a read-only view for marketplace snippets.
   *
   * @param snippet - Snippet to edit or preview.
   */
  const handleEdit = (snippet: Snippet): void => {
    const isMarketplaceSnippet = snippet.source === 'marketplace' || snippet.catalogId != null;

    openSnippetEditTab(dispatch, {
      mode: 'edit',
      snippetId: snippet.id,
      readOnly: isMarketplaceSnippet,
      label: snippet.name
    });
  };

  /**
   * Opens the create-snippet tab prefilled from an existing snippet so the
   * user can review the clone before saving it.
   *
   * @param snippet - Snippet to clone.
   */
  const handleClone = (snippet: Snippet): void => {
    openSnippetEditTab(dispatch, {
      mode: 'clone',
      snippetId: snippet.id,
      label: `${snippet.name} (clone)`
    });
  };

  /**
   * Uninstalls one marketplace snippet bundle after confirmation.
   *
   * @param pkg - Installed bundle summary to remove.
   */
  const handleUninstallPackage = async (pkg: InstalledSnippetPackage): Promise<void> => {
    const snippetLabel = pkg.snippetCount === 1 ? 'snippet' : 'snippets';
    const confirmed = await confirm({
      title: 'Uninstall snippet bundle',
      message: `Uninstall "${pkg.name}"? This removes ${pkg.snippetCount} imported ${snippetLabel} from your library.`,
      confirmLabel: 'Uninstall',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    onUninstallPackage(pkg.catalogId);
  };

  /**
   * Deletes a snippet after confirmation.
   *
   * @param snippet - Snippet to delete.
   */
  const handleDelete = async (snippet: Snippet): Promise<void> => {
    const confirmed = await confirm({
      title: 'Delete snippet',
      message: `Delete "${snippet.name}"? Requests referencing this snippet will stop running it.`,
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      await dispatch(deleteSnippet(snippet.id)).unwrap();
      if (snippet.source === 'marketplace') {
        await refreshPackages();
      }
      toast.success('Snippet deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete snippet');
    }
  };

  return (
    <Page
      embedded
      title="Installed"
      description="Manage reusable JavaScript snippets for pre-request and post-request scripts."
      icon={faTerminal}
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            onClick={handleAdd}
          >
            <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
            Add
          </Button>
          <Button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            aria-label="Import JavaScript snippet"
            onClick={() => void handleImport()}
          >
            <FaIcon icon={faFileImport} className="h-3.5 w-3.5" />
            Import
          </Button>
        </div>
      }
    >
      {installedPackages.length > 0 ? (
        <div className="mb-6 flex flex-col gap-3">
          <h2 className="m-0 text-[18px] font-medium text-text">Installed snippets</h2>
          <ResourceList className="flex flex-col gap-3">
            {installedPackages.map((pkg) => {
              const isExpanded = expandedCatalogIds.has(pkg.catalogId);
              const bundleSnippets = snippetsByCatalogId.get(pkg.catalogId) ?? [];

              return (
                <Fragment key={pkg.catalogId}>
                  <ResourceListRow
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-label={`${pkg.name}, ${isExpanded ? 'collapse' : 'expand'} snippet list`}
                    className="cursor-pointer"
                    onClick={() => toggleBundleExpanded(pkg.catalogId)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) {
                        return;
                      }
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleBundleExpanded(pkg.catalogId);
                      }
                    }}
                    primary={
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5">
                          <FaIcon
                            icon={isExpanded ? faChevronDown : faChevronRight}
                            className="h-3 w-3 shrink-0 text-muted"
                            aria-hidden="true"
                          />
                          <ResourceListPrimary>{pkg.name}</ResourceListPrimary>
                        </span>
                        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-[18px] text-[14px] text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            {pkg.author ?? 'Unknown publisher'}
                            {pkg.signature?.status === 'verified' ? (
                              <VerifiedPublisherBadge />
                            ) : null}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>v{pkg.version}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {pkg.snippetCount} snippet{pkg.snippetCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      </div>
                    }
                    actions={
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="toolbar"
                          disabled={actionBusyId === pkg.catalogId}
                          onClick={() =>
                            openSnippetCatalogDetailTab(dispatch, {
                              id: pkg.catalogId,
                              name: pkg.name
                            })
                          }
                        >
                          Details
                        </Button>
                        {pkg.installSource == null || pkg.installSource === 'git' ? (
                          <Button
                            type="button"
                            variant="toolbar"
                            disabled={actionBusyId === pkg.catalogId}
                            onClick={() => onUpdatePackage(pkg.catalogId)}
                          >
                            Update
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="toolbar"
                          className={toolbarDangerButtonClass}
                          disabled={actionBusyId === pkg.catalogId}
                          onClick={() => void handleUninstallPackage(pkg)}
                        >
                          Uninstall
                        </Button>
                      </div>
                    }
                  />
                  {isExpanded ? (
                    <li className="pl-4">
                      {bundleSnippets.length === 0 ? (
                        <span className="text-[14px] text-muted">No snippets in this bundle.</span>
                      ) : (
                        <ResourceList className="flex flex-col gap-3">
                          {bundleSnippets.map((snippet) => (
                            <ResourceListRow
                              key={snippet.id}
                              primary={
                                <div className="flex flex-col gap-1">
                                  <ResourceListPrimary>{snippet.name}</ResourceListPrimary>
                                  <CodePreviewTooltip
                                    code={snippet.code}
                                    actionLabel={`View ${snippet.name}`}
                                    onClick={() => handleEdit(snippet)}
                                    emptyLabel="Empty snippet"
                                  />
                                </div>
                              }
                              actions={
                                <Button
                                  type="button"
                                  variant="toolbar"
                                  aria-label={`Clone ${snippet.name}`}
                                  onClick={() => handleClone(snippet)}
                                >
                                  Clone
                                </Button>
                              }
                            />
                          ))}
                        </ResourceList>
                      )}
                    </li>
                  ) : null}
                </Fragment>
              );
            })}
          </ResourceList>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-1">
        <span className="text-[18px] font-medium text-text">Custom snippets</span>
        <AsyncListState
          loading={loading}
          error={loadError}
          onRetry={() => void dispatch(refreshSnippets())}
          isEmpty={!loading && !loadError && standaloneSnippets.length === 0}
          emptyMessage="No snippets yet."
        >
          <ResourceList className="flex flex-col gap-4">
            {standaloneSnippets.map((snippet) => (
              <ResourceListRow
                key={snippet.id}
                primary={
                  <div className="flex flex-col gap-1">
                    <ResourceListPrimary>{snippet.name}</ResourceListPrimary>
                    <span className="text-[14px] text-muted">
                      {snippetScopeLabel(snippet.scope)}
                      {snippet.connectionId ? (
                        <>
                          {' '}
                          ·{' '}
                          {providerLabelById.get(snippet.connectionId) ??
                            'Unknown storage location'}
                        </>
                      ) : null}
                    </span>
                    <CodePreviewTooltip
                      code={snippet.code}
                      actionLabel={`Edit ${snippet.name}`}
                      onClick={() => handleEdit(snippet)}
                      emptyLabel="Empty snippet"
                    />
                  </div>
                }
                actions={
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="toolbar"
                      aria-label={`Edit ${snippet.name}`}
                      onClick={() => handleEdit(snippet)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="toolbar"
                      aria-label={`Clone ${snippet.name}`}
                      onClick={() => handleClone(snippet)}
                    >
                      Clone
                    </Button>
                    <Button
                      type="button"
                      variant="toolbar"
                      className={toolbarDangerButtonClass}
                      aria-label={`Delete ${snippet.name}`}
                      onClick={() => void handleDelete(snippet)}
                    >
                      Delete
                    </Button>
                  </div>
                }
              />
            ))}
          </ResourceList>
        </AsyncListState>
      </div>
    </Page>
  );
}
