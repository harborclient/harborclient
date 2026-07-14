import { ControlledAccordion } from '@szhsin/react-accordion';
import {
  Toolbar,
  type ToolbarAction,
  ResizeHandle,
  useResizable,
  FaIcon
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import {
  faCodeBranch,
  faList,
  faClockRotateLeft,
  faPenToSquare,
  faDownload,
  faArrowUp
} from '#/renderer/src/fontawesome';
import { Scrollbars } from '#/renderer/src/components/Scrollbars';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectSelectedCollectionId } from '#/renderer/src/store/selectors';
import { Section } from '#/renderer/src/ui/sidebars/CollectionSidebar/Section';
import { useSidebarGit } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarGitContext';
import { GitSidebarEmptyState } from '#/renderer/src/ui/sidebars/GitSidebar/GitSidebarEmptyState';
import { GitCommitMessageSection } from '#/renderer/src/ui/sidebars/GitSidebar/GitCommitMessageSection';
import { GitChangesSection } from '#/renderer/src/ui/sidebars/GitSidebar/GitChangesSection';
import { GitCommitsSection } from '#/renderer/src/ui/sidebars/GitSidebar/GitCommitsSection';
import { useGitSidebarSections } from '#/renderer/src/ui/sidebars/GitSidebar/useGitSidebarSections';

/**
 * Right-side Git source-control panel with accordion sections for commit, changes,
 * and commits.
 */
export function GitSidebar(): JSX.Element {
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const collections = useAppSelector(selectCollections);
  const { activeGitContext: gitContext, refreshGitSidebar, refreshGitStatuses } = useSidebarGit();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  const selectedCollection =
    selectedCollectionId != null
      ? collections.find((collection) => collection.id === selectedCollectionId)
      : undefined;

  const { accordion, sectionVisibility, setSectionVisible } = useGitSidebarSections();

  const activeConnectionId = gitContext?.connectionId;
  const activeCollectionUuid = gitContext?.collectionUuid;

  /**
   * Refreshes connection-level git status when the sidebar opens or the active
   * git collection changes.
   *
   * The Changes section loads a fresh per-collection diff on mount, but the
   * Commit button's change counts come from the periodically polled status. Without
   * this, opening the sidebar right after adding a request shows the change while the
   * Commit button stays disabled until the next poll. Refreshing here keeps the two in
   * sync. `refreshGitStatuses` is stable, so this only runs on mount and when the
   * targeted connection or collection changes.
   */
  useEffect(() => {
    if (activeConnectionId == null) {
      return;
    }
    refreshGitStatuses();
  }, [activeConnectionId, activeCollectionUuid, refreshGitStatuses]);

  /**
   * Whether every Git sidebar section is hidden via the toolbar toggles.
   */
  const allSectionsHidden = useMemo(
    () => Object.values(sectionVisibility).every((visible) => !visible),
    [sectionVisibility]
  );

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
   * Refreshes git status and commit history after operations.
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
        className="flex h-full min-h-0 shrink-0 flex-col bg-sidebar"
        style={{ width }}
        aria-label="Git source control"
      >
        <div className="flex items-center gap-2 border-b border-separator px-2 py-1 h-[56px]">
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
          <GitSidebarEmptyState selectedCollectionName={selectedCollection?.name} />
        ) : (
          <Scrollbars className="min-h-0 flex-1">
            {allSectionsHidden ? (
              <div className="px-2 py-3 text-muted" role="status">
                All Git sidebar sections are hidden. Use the toolbar above to show commit, changes,
                or commits.
              </div>
            ) : null}
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
                      collectionUuid={gitContext.collectionUuid}
                      status={gitContext.status}
                      refreshNonce={refreshNonce}
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
            </ControlledAccordion>
          </Scrollbars>
        )}
      </aside>
    </>
  );
}
