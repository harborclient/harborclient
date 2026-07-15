import {
  FaIcon,
  Sidebar,
  SidebarSections,
  Toolbar,
  type SidebarSectionConfig,
  type ToolbarAction
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
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectSelectedCollectionId } from '#/renderer/src/store/selectors';
import { useSidebarGit } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarGitContext';
import { GitSidebarEmptyState } from './GitSidebarEmptyState';
import { GitCommitMessageSection } from './GitCommitMessageSection';
import { GitChangesSection } from './GitChangesSection';
import { GitCommitsSection } from './GitCommitsSection';
import { useGitSidebarSections } from './useGitSidebarSections';

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

  const { expanded, onToggle, sectionVisibility, setSectionVisible } = useGitSidebarSections();

  const activeConnectionId = gitContext?.connectionId;
  const activeCollectionUuid = gitContext?.collectionUuid;

  /**
   * Refreshes connection-level git status when the sidebar opens or the active
   * git collection changes.
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

  /**
   * Collapsible section config for the Git sidebar body.
   */
  const sections = useMemo((): SidebarSectionConfig[] => {
    if (gitContext == null) {
      return [];
    }

    const result: SidebarSectionConfig[] = [];

    if (sectionVisibility.commitMessage) {
      result.push({
        key: 'commitMessage',
        title: 'Commit message',
        ariaLabel: 'Commit message',
        initialEntered: true,
        children: (
          <GitCommitMessageSection
            connectionId={gitContext.connectionId}
            connectionName={gitContext.connectionName}
            collectionUuid={gitContext.collectionUuid}
            status={gitContext.status}
            onRefresh={handleRefresh}
          />
        )
      });
    }

    if (sectionVisibility.changes) {
      result.push({
        key: 'changes',
        title: 'Changes',
        ariaLabel: 'Changes',
        initialEntered: true,
        flushBody: true,
        children: (
          <GitChangesSection
            collectionUuid={gitContext.collectionUuid}
            status={gitContext.status}
            refreshNonce={refreshNonce}
            onRefresh={handleRefresh}
          />
        )
      });
    }

    if (sectionVisibility.commits) {
      result.push({
        key: 'commits',
        title: 'Commits',
        ariaLabel: 'Commits',
        initialEntered: true,
        children: (
          <GitCommitsSection connectionId={gitContext.connectionId} refreshNonce={refreshNonce} />
        )
      });
    }

    return result;
  }, [gitContext, handleRefresh, refreshNonce, sectionVisibility]);

  return (
    <Sidebar
      side="right"
      ariaLabel="Git source control"
      storageKey="hc.gitSidebarWidth"
      defaultSize={360}
      minSize={280}
      getMaxSize={() => 640}
      resizeAriaLabel="Resize Git sidebar"
      header={
        <>
          <div className="flex h-[56px] items-center gap-2 border-b border-separator px-2 py-1">
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
        </>
      }
    >
      {gitContext == null ? (
        <GitSidebarEmptyState selectedCollectionName={selectedCollection?.name} />
      ) : (
        <>
          {allSectionsHidden ? (
            <div className="px-2 py-3 text-muted" role="status">
              All Git sidebar sections are hidden. Use the toolbar above to show commit, changes, or
              commits.
            </div>
          ) : null}
          <SidebarSections sections={sections} expanded={expanded} onToggle={onToggle} />
        </>
      )}
    </Sidebar>
  );
}
