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
import {
  createSnippet,
  deleteSnippet,
  refreshSnippets,
  updateSnippet
} from '#/renderer/src/store/thunks/snippets';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { CodePreviewTooltip } from '#/renderer/src/ui/shared/CodePreviewTooltip';
import { SnippetEditModal } from '#/renderer/src/ui/shared/SnippetEditModal';
import {
  createBlankSnippet,
  createImportedSnippetDraft,
  type SnippetEditDraft
} from '#/renderer/src/ui/shared/snippetEditDraft';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<SnippetEditDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedCatalogIds, setExpandedCatalogIds] = useState<Set<string>>(new Set());

  /**
   * Maps installed bundle summaries by catalog id for marketplace snippet metadata.
   */
  const packagesByCatalogId = useMemo(
    () => new Map(installedPackages.map((pkg) => [pkg.catalogId, pkg])),
    [installedPackages]
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
   * Opens the create snippet modal with a blank draft.
   */
  const handleAdd = (): void => {
    setEditingDraft(createBlankSnippet());
    setIsNew(true);
    setError(null);
  };

  /**
   * Reads a `.js` file and opens the create modal with imported source.
   */
  const handleImport = async (): Promise<void> => {
    try {
      const result = await window.api.importSnippetFile();
      if (!result) {
        return;
      }

      setEditingDraft(createImportedSnippetDraft(result.code));
      setIsNew(true);
      setError(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import snippet');
    }
  };

  /**
   * Opens the edit modal for an existing local snippet.
   *
   * @param snippet - Snippet to edit.
   */
  const handleEdit = (snippet: Snippet): void => {
    if (snippet.source === 'marketplace' || snippet.catalogId) {
      return;
    }

    setEditingDraft({
      id: snippet.id,
      name: snippet.name,
      code: snippet.code,
      scope: snippet.scope
    });
    setIsNew(false);
    setError(null);
  };

  /**
   * Closes the edit modal and clears transient error state.
   */
  const handleCancelEdit = (): void => {
    setEditingDraft(null);
    setIsNew(false);
    setError(null);
  };

  /**
   * Persists the snippet draft through create or update IPC.
   */
  const handleSave = async (): Promise<void> => {
    if (!editingDraft) {
      return;
    }

    const trimmedName = editingDraft.name.trim();
    if (!trimmedName) {
      setError('Snippet name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isNew || editingDraft.id == null) {
        await dispatch(
          createSnippet({
            name: trimmedName,
            code: editingDraft.code,
            scope: editingDraft.scope
          })
        ).unwrap();
        toast.success('Snippet created');
      } else {
        await dispatch(
          updateSnippet({
            id: editingDraft.id,
            name: trimmedName,
            code: editingDraft.code,
            scope: editingDraft.scope
          })
        ).unwrap();
        toast.success('Snippet saved');
      }
      handleCancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save snippet');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Creates an editable local copy of one snippet.
   *
   * @param snippet - Snippet to clone.
   */
  const handleClone = async (snippet: Snippet): Promise<void> => {
    try {
      await dispatch(
        createSnippet({
          name: `${snippet.name} (clone)`,
          code: snippet.code,
          scope: snippet.scope
        })
      ).unwrap();
      toast.success('Snippet cloned');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clone snippet');
    }
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
                          <span>
                            {pkg.author ?? 'Unknown publisher'} · v{pkg.version}
                          </span>
                          {pkg.signature?.status === 'verified' ? <VerifiedPublisherBadge /> : null}
                          <span aria-hidden="true">·</span>
                          <span>
                            {pkg.snippetCount} snippet{pkg.snippetCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      </div>
                    }
                    actions={
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                          onClick={() => onUninstallPackage(pkg.catalogId)}
                        >
                          Uninstall
                        </Button>
                      </div>
                    }
                  />
                  {isExpanded ? (
                    <li className="flex flex-col gap-2 rounded-[10px] border border-separator/60 bg-selection/20 p-3">
                      {bundleSnippets.length === 0 ? (
                        <span className="text-[14px] text-muted">No snippets in this bundle.</span>
                      ) : (
                        bundleSnippets.map((snippet) => (
                          <div key={snippet.id} className="flex items-center justify-between gap-3">
                            <span className="text-[14px] text-text">{snippet.name}</span>
                            <Button
                              type="button"
                              variant="toolbar"
                              aria-label={`Clone ${snippet.name}`}
                              onClick={() => void handleClone(snippet)}
                            >
                              Clone
                            </Button>
                          </div>
                        ))
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
        <span className="text-[18px] font-medium text-text">All snippets</span>
        <AsyncListState
          loading={loading}
          error={loadError}
          onRetry={() => void dispatch(refreshSnippets())}
          isEmpty={!loading && !loadError && snippets.length === 0}
          emptyMessage="No snippets yet."
        >
          <ResourceList className="flex flex-col gap-4">
            {snippets.map((snippet) => {
              const installedPackage = snippet.catalogId
                ? packagesByCatalogId.get(snippet.catalogId)
                : undefined;
              const isMarketplaceSnippet =
                snippet.source === 'marketplace' || snippet.catalogId != null;
              const snippetVersion = snippet.catalogVersion ?? installedPackage?.version;
              const snippetAuthor =
                snippet.catalogAuthor ?? installedPackage?.author ?? 'Unknown publisher';

              return (
                <ResourceListRow
                  key={snippet.id}
                  primary={
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <ResourceListPrimary>{snippet.name}</ResourceListPrimary>
                        {isMarketplaceSnippet ? (
                          <span className="inline-flex items-center gap-1.5 text-[14px] text-muted">
                            <span>
                              {snippetAuthor}
                              {snippetVersion ? ` · v${snippetVersion}` : null}
                            </span>
                            {installedPackage?.signature?.status === 'verified' ? (
                              <VerifiedPublisherBadge />
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[14px] text-muted">
                        {snippetScopeLabel(snippet.scope)}
                      </span>
                      <CodePreviewTooltip
                        code={snippet.code}
                        actionLabel={
                          isMarketplaceSnippet ? `View ${snippet.name}` : `Edit ${snippet.name}`
                        }
                        onClick={() => handleEdit(snippet)}
                        emptyLabel="Empty snippet"
                      />
                    </div>
                  }
                  actions={
                    <div className="flex items-center gap-2">
                      {!isMarketplaceSnippet ? (
                        <Button
                          type="button"
                          variant="toolbar"
                          aria-label={`Edit ${snippet.name}`}
                          onClick={() => handleEdit(snippet)}
                        >
                          Edit
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="toolbar"
                        aria-label={`Clone ${snippet.name}`}
                        onClick={() => void handleClone(snippet)}
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
              );
            })}
          </ResourceList>
        </AsyncListState>
      </div>

      {editingDraft ? (
        <SnippetEditModal
          draft={editingDraft}
          isNew={isNew}
          saving={saving}
          error={error}
          onChange={setEditingDraft}
          onCancel={handleCancelEdit}
          onSave={() => void handleSave()}
        />
      ) : null}
    </Page>
  );
}
