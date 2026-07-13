import { ControlledAccordion } from '@szhsin/react-accordion';
import {
  Toolbar,
  type ToolbarAction,
  ResizeHandle,
  useResizable,
  FaIcon
} from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import {
  faCodeBranch,
  faList,
  faClockRotateLeft,
  faDiagramProject,
  faPenToSquare,
  faDownload,
  faArrowUp
} from '#/renderer/src/fontawesome';
import { Scrollbars } from '#/renderer/src/components/Scrollbars';
import { resolveCollectionGitContext } from '#/renderer/src/git/resolveCollectionGitContext';
import { useProviders } from '#/renderer/src/hooks/useProviders';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectCollections,
  selectDocumentsByCollection,
  selectDraft,
  selectRequestsByCollection,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { Section } from '#/renderer/src/ui/sidebars/CollectionSidebar/Section';
import { useSidebarGit } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarGitContext';
import { GitSidebarEmptyState } from '#/renderer/src/ui/sidebars/GitSidebar/GitSidebarEmptyState';
import { GitCommitMessageSection } from '#/renderer/src/ui/sidebars/GitSidebar/GitCommitMessageSection';
import { GitChangesSection } from '#/renderer/src/ui/sidebars/GitSidebar/GitChangesSection';
import { GitCommitsSection } from '#/renderer/src/ui/sidebars/GitSidebar/GitCommitsSection';
import { GitHistorySection } from '#/renderer/src/ui/sidebars/GitSidebar/GitHistorySection';
import { useGitSidebarSections } from '#/renderer/src/ui/sidebars/GitSidebar/useGitSidebarSections';

/**
 * Right-side Git source-control panel with accordion sections for commit, changes,
 * commits, and history.
 */
export function GitSidebar(): JSX.Element {
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const draft = useAppSelector(selectDraft);
  const collections = useAppSelector(selectCollections);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const documentsByCollection = useAppSelector(selectDocumentsByCollection);
  const { providers, primaryProviderId } = useProviders();
  const { gitStatusesByConnectionId, refreshGitSidebar } = useSidebarGit();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  const connectionNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const provider of providers) {
      map[provider.id] = provider.name;
    }
    return map;
  }, [providers]);

  const connectionTypesById = useMemo(() => {
    const map: Record<string, (typeof providers)[number]['type']> = {};
    for (const provider of providers) {
      if (provider.type != null) {
        map[provider.id] = provider.type;
      }
    }
    return map;
  }, [providers]);

  const activeCollectionId = draft.collection_id ?? selectedCollectionId;
  const gitContext = resolveCollectionGitContext({
    collectionId: activeCollectionId,
    collections,
    primaryConnectionId: primaryProviderId,
    connectionNamesById,
    connectionTypesById,
    gitStatusesByConnectionId
  });

  const { accordion, sectionVisibility, setSectionVisible } = useGitSidebarSections();

  const {
    size: width,
    minSize: sidebarMinSize,
    maxSize: sidebarMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'x',
    direction: -1,
    defaultSize: 360,
    minSize: 280,
    getMaxSize: () => 640,
    storageKey: 'hc.gitSidebarWidth'
  });

  /**
   * Refreshes git status, request statuses, and commit history after operations.
   */
  const handleRefresh = useCallback((): void => {
    refreshGitSidebar();
    setRefreshNonce((value) => value + 1);
  }, [refreshGitSidebar]);

  /**
   * Runs pull or push and refreshes sidebar state on completion.
   *
   * @param action - Git sync operation to execute.
   */
  const runSyncAction = useCallback(
    async (action: () => Promise<void>): Promise<void> => {
      setBusy(true);
      try {
        await action();
        handleRefresh();
      } catch (err) {
        handleRefresh();
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [handleRefresh]
  );

  const status = gitContext?.status ?? null;
  const hasUnpushed = status?.syncKnown === true && (status.ahead ?? 0) > 0;

  /**
   * Toolbar actions for section visibility and pull/push sync controls.
   */
  const toolbarActions = useMemo((): ToolbarAction[] => {
    const sectionActions: ToolbarAction[] = [
      {
        id: 'git-section-commit',
        icon: faPenToSquare,
        label: 'Commit message section',
        title: sectionVisibility.commitMessage
          ? 'Hide Commit message section'
          : 'Show Commit message section',
        ariaPressed: sectionVisibility.commitMessage,
        onClick: () => setSectionVisible('commitMessage', !sectionVisibility.commitMessage)
      },
      {
        id: 'git-section-changes',
        icon: faList,
        label: 'Changes section',
        title: sectionVisibility.changes ? 'Hide Changes section' : 'Show Changes section',
        ariaPressed: sectionVisibility.changes,
        onClick: () => setSectionVisible('changes', !sectionVisibility.changes)
      },
      {
        id: 'git-section-commits',
        icon: faClockRotateLeft,
        label: 'Commits section',
        title: sectionVisibility.commits ? 'Hide Commits section' : 'Show Commits section',
        ariaPressed: sectionVisibility.commits,
        onClick: () => setSectionVisible('commits', !sectionVisibility.commits)
      },
      {
        id: 'git-section-history',
        icon: faDiagramProject,
        label: 'History section',
        title: sectionVisibility.history ? 'Hide History section' : 'Show History section',
        ariaPressed: sectionVisibility.history,
        onClick: () => setSectionVisible('history', !sectionVisibility.history)
      }
    ];

    return sectionActions;
  }, [sectionVisibility, setSectionVisible]);

  /**
   * Right-aligned pull and push icon actions for the Git toolbar.
   */
  const toolbarSyncActions = useMemo((): ToolbarAction[] => {
    if (gitContext == null) {
      return [];
    }

    const pushLabel =
      hasUnpushed && status != null ? `Push (${status.ahead} commit(s) ahead)` : 'Push changes';

    return [
      {
        id: 'git-pull',
        icon: faDownload,
        label: 'Pull changes',
        title: 'Pull changes',
        disabled: busy,
        onClick: () => void runSyncAction(() => window.api.gitPull(gitContext.connectionId))
      },
      {
        id: 'git-push',
        icon: faArrowUp,
        label: pushLabel,
        title: pushLabel,
        disabled: busy,
        onClick: () => void runSyncAction(() => window.api.gitPush(gitContext.connectionId))
      }
    ];
  }, [busy, gitContext, hasUnpushed, runSyncAction, status]);

  return (
    <>
      <ResizeHandle
        orientation="vertical"
        value={width}
        min={sidebarMinSize}
        max={sidebarMaxSize}
        onResizeStart={onResizeStart}
        onKeyboardResize={onKeyboardResize}
        ariaLabel="Resize Git sidebar"
        className="border-r-0 border-l border-separator"
      />
      <aside
        className="flex min-h-0 shrink-0 flex-col bg-sidebar"
        style={{ width }}
        aria-label="Git source control"
      >
        <div className="flex items-center gap-2 border-b border-separator px-2 py-1">
          <div className="inline-flex min-w-0 items-center gap-1.5 text-text">
            <FaIcon icon={faCodeBranch} className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate font-medium">{gitContext?.collectionName ?? 'Git'}</span>
          </div>
        </div>

        <div className={hasUnpushed ? 'hc-git-sidebar-push-ahead' : undefined}>
          <Toolbar
            ariaLabel="Git sidebar sections"
            actions={toolbarActions}
            toggles={toolbarSyncActions}
          />
        </div>

        {gitContext == null ? (
          <GitSidebarEmptyState />
        ) : (
          <Scrollbars className="min-h-0 flex-1">
            <ControlledAccordion providerValue={accordion}>
              {sectionVisibility.commitMessage && (
                <nav aria-label="Commit message">
                  <Section itemKey="commitMessage" title="Commit message" initialEntered={true}>
                    <GitCommitMessageSection
                      connectionId={gitContext.connectionId}
                      connectionName={gitContext.connectionName}
                      collectionUuid={gitContext.collectionUuid}
                      status={gitContext.status}
                      onRefresh={handleRefresh}
                    />
                  </Section>
                </nav>
              )}
              {sectionVisibility.changes && (
                <nav aria-label="Changes">
                  <Section itemKey="changes" title="Changes" initialEntered={true} flushBody>
                    <GitChangesSection
                      connectionId={gitContext.connectionId}
                      collectionUuid={gitContext.collectionUuid}
                      status={gitContext.status}
                      requests={requestsByCollection[gitContext.collectionId] ?? []}
                      documents={documentsByCollection[gitContext.collectionId] ?? []}
                      onRefresh={handleRefresh}
                    />
                  </Section>
                </nav>
              )}
              {sectionVisibility.commits && (
                <nav aria-label="Commits">
                  <Section itemKey="commits" title="Commits" initialEntered={true}>
                    <GitCommitsSection
                      connectionId={gitContext.connectionId}
                      refreshNonce={refreshNonce}
                    />
                  </Section>
                </nav>
              )}
              {sectionVisibility.history && (
                <nav aria-label="History">
                  <Section itemKey="history" title="History" initialEntered={true}>
                    <GitHistorySection
                      connectionId={gitContext.connectionId}
                      refreshNonce={refreshNonce}
                    />
                  </Section>
                </nav>
              )}
            </ControlledAccordion>
          </Scrollbars>
        )}
      </aside>
    </>
  );
}
