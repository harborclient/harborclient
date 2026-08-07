import { useCallback, useMemo, useRef, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TeamHub } from '@harborclient/core/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { useTeamHubServiceScan } from '#/renderer/src/hooks/useTeamHubServiceScan';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectCollections,
  selectFoldersByCollection,
  selectRequestsByCollection
} from '#/renderer/src/store/selectors';
import { refreshHubLlmModels } from '#/renderer/src/store/thunks/aiChat';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { navigateTeamHubNotice } from './navigateTeamHubNotice';
import { TeamHubNoticesPanel } from './TeamHubNoticesPanel';
import { TeamHubRailAvatar } from './TeamHubRailAvatar';
import { useTeamHubNotices } from './useTeamHubNotices';

interface Props {
  /**
   * Whether the sidebar rail shows labels beside icons.
   */
  expanded: boolean;
}

/**
 * Resolves the display name used for local avatar fallback initials.
 *
 * Prefers the live session user name from the latest scan, then the persisted
 * user name on the hub record, then the connection display name.
 *
 * Server-provided hub avatar initials take precedence in {@link TeamHubRailAvatar}.
 *
 * @param hub - Configured team hub.
 * @param scanUserName - Authenticated user name from the latest session scan.
 */
function resolveFallbackDisplayName(hub: TeamHub, scanUserName: string | undefined): string {
  return scanUserName?.trim() || hub.userName?.trim() || hub.name.trim() || 'Team Hub';
}

/**
 * Team Hub connection avatars rendered in the sidebar rail footer.
 *
 * Each configured hub gets a square initials avatar with unread notice badges.
 * Clicking a connected hub with communication enabled opens the notices dropdown;
 * disconnected hubs still toggle connect/disconnect with confirmation.
 *
 * @param props - Rail expanded state for avatar label density.
 */
export function TeamHubRailAvatars({ expanded }: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const collections = useAppSelector(selectCollections);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const { teamHubs, loading, error, reload, reloadToken } = useTeamHubs();
  const { serviceFlagsByHubId, userNameByHubId, hubAvatarByHubId, rescanServices, scanning } =
    useTeamHubServiceScan(teamHubs, reloadToken, !loading && error == null);
  const communicationHubIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [hubId, flags] of serviceFlagsByHubId.entries()) {
      if (flags.communication) {
        ids.add(hubId);
      }
    }
    return ids;
  }, [serviceFlagsByHubId]);
  const notices = useTeamHubNotices(
    teamHubs,
    communicationHubIds,
    reloadToken + (scanning ? 0 : 1),
    !loading && error == null
  );
  const [pendingHubId, setPendingHubId] = useState<string | null>(null);
  const [openNoticesHubId, setOpenNoticesHubId] = useState<string | null>(null);
  const anchorRefs = useRef(new Map<string, HTMLButtonElement>());

  /**
   * Returns a ref-like object for one hub avatar button.
   *
   * @param hubId - Team hub connection id.
   */
  const anchorRefForHub = useCallback((hubId: string): { current: HTMLButtonElement | null } => {
    return {
      get current() {
        return anchorRefs.current.get(hubId) ?? null;
      },
      set current(_value: HTMLButtonElement | null) {
        // Populated through registerAnchor callbacks on TeamHubRailAvatar.
      }
    };
  }, []);

  /**
   * Keeps the portaled notices panel anchored to the same ref object while open.
   */
  const openNoticesAnchorRef = useMemo(
    () => (openNoticesHubId == null ? { current: null } : anchorRefForHub(openNoticesHubId)),
    [anchorRefForHub, openNoticesHubId]
  );

  /**
   * Soft-connects or soft-disconnects a hub, then refreshes dependent UI.
   *
   * @param hub - Team hub whose connection state should toggle.
   */
  const handleToggle = useCallback(
    async (hub: TeamHub): Promise<void> => {
      if (pendingHubId != null) {
        return;
      }

      const currentlyConnected = hub.connected !== false;
      if (currentlyConnected) {
        const confirmed = await confirm({
          title: `Disconnect from "${hub.name || 'Team Hub'}"?`,
          message: 'Are you sure?',
          confirmLabel: 'Disconnect',
          variant: 'danger'
        });
        if (!confirmed) {
          return;
        }
      }

      setPendingHubId(hub.id);
      try {
        await window.api.setTeamHubConnected(hub.id, !currentlyConnected);
        reload();
        rescanServices();
        await dispatch(refreshCollections());
        void dispatch(refreshHubLlmModels());
        toast.success(
          currentlyConnected
            ? `Disconnected from ${hub.name || 'Team Hub'}.`
            : `Connected to ${hub.name || 'Team Hub'}.`
        );
      } catch (err: unknown) {
        showAlert(
          dispatch,
          err instanceof Error ? err.message : String(err),
          currentlyConnected ? 'Disconnect failed' : 'Connect failed'
        );
      } finally {
        setPendingHubId(null);
      }
    },
    [confirm, dispatch, pendingHubId, reload, rescanServices]
  );

  /**
   * Navigates to the entity referenced by a notice row.
   *
   * @param hubId - Team hub connection id.
   * @param notice - Selected notice row.
   */
  const handleNavigateNotice = useCallback(
    async (
      hubId: string,
      notice: import('@harborclient/core/types').TeamHubNotice
    ): Promise<void> => {
      const ok = await navigateTeamHubNotice(dispatch, hubId, notice, {
        collections,
        requestsByCollection,
        foldersByCollection
      });
      if (!ok) {
        showAlert(
          dispatch,
          'The referenced item is not available in your connected collections. Try syncing the Team Hub first.',
          'Notice target unavailable'
        );
      }
    },
    [collections, dispatch, foldersByCollection, requestsByCollection]
  );

  /**
   * Loads the open hub's notice list for the portaled dropdown.
   *
   * @param hubId - Team hub connection id.
   */
  const handleLoadNotices = useCallback(
    async (hubId: string): Promise<void> => {
      await notices.loadNotices(hubId);
    },
    [notices.loadNotices]
  );

  /**
   * Marks one notice read for the open hub.
   *
   * @param noticeId - Notice record identifier.
   */
  const handleMarkRead = useCallback(
    async (noticeId: string): Promise<void> => {
      if (openNoticesHubId == null) {
        return;
      }
      await notices.markNoticeRead(openNoticesHubId, noticeId);
    },
    [notices.markNoticeRead, openNoticesHubId]
  );

  /**
   * Marks every notice read for the open hub.
   */
  const handleMarkAllRead = useCallback(async (): Promise<void> => {
    if (openNoticesHubId == null) {
      return;
    }
    await notices.markAllRead(openNoticesHubId);
  }, [notices.markAllRead, openNoticesHubId]);

  /**
   * Navigates from a notice row in the open hub's dropdown.
   *
   * @param notice - Selected notice row.
   */
  const handleOpenNoticeNavigate = useCallback(
    async (notice: import('@harborclient/core/types').TeamHubNotice): Promise<void> => {
      if (openNoticesHubId == null) {
        return;
      }
      await handleNavigateNotice(openNoticesHubId, notice);
    },
    [handleNavigateNotice, openNoticesHubId]
  );

  /**
   * Closes the notices dropdown.
   */
  const handleDismissNotices = useCallback((): void => {
    setOpenNoticesHubId(null);
  }, []);

  if (loading || error != null || teamHubs.length === 0) {
    return null;
  }

  const openHub = openNoticesHubId
    ? teamHubs.find((entry) => entry.id === openNoticesHubId)
    : undefined;
  const openBucket = openNoticesHubId ? notices.bucketsByHubId.get(openNoticesHubId) : undefined;

  return (
    <>
      <div
        className="hc-team-hub-rail-avatars flex flex-col items-stretch"
        role="group"
        aria-label="Team Hub connections"
      >
        {teamHubs.map((hub) => {
          const connected = hub.connected !== false;
          const online = serviceFlagsByHubId.get(hub.id)?.storage ?? false;
          const noticesEnabled = connected && communicationHubIds.has(hub.id);
          const fallbackDisplayName = resolveFallbackDisplayName(hub, userNameByHubId.get(hub.id));
          const bucket = notices.bucketsByHubId.get(hub.id);

          return (
            <TeamHubRailAvatar
              key={hub.id}
              hubId={hub.id}
              hubName={hub.name || 'Untitled'}
              hubAvatar={hubAvatarByHubId.get(hub.id)}
              fallbackDisplayName={fallbackDisplayName}
              connected={connected}
              online={online}
              expanded={expanded}
              unreadNoticeCount={bucket?.unreadCount ?? 0}
              noticesEnabled={noticesEnabled}
              registerAnchor={(element) => {
                if (element) {
                  anchorRefs.current.set(hub.id, element);
                } else {
                  anchorRefs.current.delete(hub.id);
                }
              }}
              onToggle={() => {
                void handleToggle(hub);
              }}
              onOpenNotices={() => {
                setOpenNoticesHubId(hub.id);
              }}
            />
          );
        })}
      </div>
      <div
        className="hc-sidebar-rail-separator h-px w-full shrink-0 bg-sidebar-rail-separator"
        aria-hidden
      />
      {openHub && openBucket ? (
        <TeamHubNoticesPanel
          hubId={openHub.id}
          hubName={openHub.name || 'Team Hub'}
          anchorRef={openNoticesAnchorRef}
          bucket={openBucket}
          onDismiss={handleDismissNotices}
          onLoadNotices={handleLoadNotices}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onNavigate={handleOpenNoticeNavigate}
        />
      ) : null}
    </>
  );
}
