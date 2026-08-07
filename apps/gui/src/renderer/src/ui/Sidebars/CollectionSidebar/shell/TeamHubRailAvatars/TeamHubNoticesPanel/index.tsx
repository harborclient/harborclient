import {
  clampMenuPosition,
  getTriggerAnchoredMenuPosition,
  MENU_MIN_WIDTH_PX,
  MENU_VIEWPORT_MARGIN_PX,
  portalToBody,
  type MenuPosition
} from '@harborclient/sdk/components';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type RefObject
} from 'react';
import type { TeamHubNotice } from '@harborclient/core/types';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { TEAM_HUB_NOTIFICATIONS_SETTING_ID } from '#/renderer/src/ui/Tabs/Settings/extras/GeneralTeamHubNotificationsExtra';
import type { TeamHubNoticeBucket } from '../useTeamHubNotices';
import { TeamHubNoticeRow } from '../TeamHubNoticeRow';

/**
 * Fallback panel height used before the portaled dialog is measured.
 */
const PANEL_ESTIMATED_HEIGHT_PX = 360;

/**
 * Preferred panel width used for anchoring before measurement.
 */
const PANEL_MIN_WIDTH_PX = Math.max(MENU_MIN_WIDTH_PX, 320);

interface Props {
  /**
   * Team hub connection id whose notices are shown.
   */
  hubId: string;

  /**
   * Connection display name for the panel header.
   */
  hubName: string;

  /**
   * Trigger element used to anchor the dropdown near the rail avatar.
   */
  anchorRef: RefObject<HTMLElement | null>;

  /**
   * Notice bucket state for the hub.
   */
  bucket: TeamHubNoticeBucket;

  /**
   * Called when the panel should close.
   */
  onDismiss: () => void;

  /**
   * Loads notices when the panel opens for a hub.
   *
   * @param hubId - Team hub connection id.
   */
  onLoadNotices: (hubId: string) => Promise<void>;

  /**
   * Marks one notice as read.
   *
   * @param noticeId - Notice record identifier.
   */
  onMarkRead: (noticeId: string) => Promise<void>;

  /**
   * Marks every notice as read.
   */
  onMarkAllRead: () => Promise<void>;

  /**
   * Navigates to the notice target and closes the panel.
   *
   * @param notice - Selected notice row.
   */
  onNavigate: (notice: TeamHubNotice) => Promise<void>;
}

/**
 * Chooses whether the notices panel should open above or below the avatar.
 *
 * Prefers the side with enough room for the measured (or estimated) height, and
 * falls back to whichever side has more space when neither fits.
 *
 * @param triggerRect - Avatar button bounds in viewport coordinates.
 * @param panelHeight - Measured or estimated panel height.
 */
function resolvePanelPlacement(triggerRect: DOMRect, panelHeight: number): 'down' | 'up' {
  const spaceBelow = window.innerHeight - triggerRect.bottom - MENU_VIEWPORT_MARGIN_PX;
  const spaceAbove = triggerRect.top - MENU_VIEWPORT_MARGIN_PX;
  if (spaceBelow >= panelHeight) {
    return 'down';
  }
  if (spaceAbove >= panelHeight) {
    return 'up';
  }
  return spaceAbove > spaceBelow ? 'up' : 'down';
}

/**
 * Portaled notifications dropdown anchored to a Team Hub rail avatar.
 */
export function TeamHubNoticesPanel({
  hubId,
  hubName,
  anchorRef,
  bucket,
  onDismiss,
  onLoadNotices,
  onMarkRead,
  onMarkAllRead,
  onNavigate
}: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const panelRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const showInitialLoading = bucket.loading && bucket.notices.length === 0;

  /**
   * Loads notices once whenever the open hub changes.
   */
  useEffect(() => {
    void onLoadNotices(hubId);
  }, [hubId, onLoadNotices]);

  /**
   * Clamps the portaled panel inside the viewport, flipping above the avatar
   * when there is not enough room below.
   */
  const updateMenuPosition = useCallback((): void => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const panelRect = panelRef.current?.getBoundingClientRect();
    const menuSize = {
      width: panelRect?.width ?? PANEL_MIN_WIDTH_PX,
      height: panelRect?.height ?? PANEL_ESTIMATED_HEIGHT_PX
    };
    const placement = resolvePanelPlacement(rect, menuSize.height);
    const nextPosition = clampMenuPosition(
      getTriggerAnchoredMenuPosition(rect, menuSize, placement),
      menuSize
    );
    setMenuPosition((current) =>
      current.x === nextPosition.x && current.y === nextPosition.y ? current : nextPosition
    );
  }, [anchorRef]);

  /**
   * Re-clamps after mount and whenever panel content size is likely to change.
   */
  useLayoutEffect(() => {
    updateMenuPosition();
  }, [bucket.loading, bucket.notices.length, updateMenuPosition]);

  /**
   * Dismisses on outside click and Escape while the panel is open.
   */
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      onDismiss();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [anchorRef, onDismiss, updateMenuPosition]);

  /**
   * Activates a notice row: mark read, navigate, and dismiss the panel.
   *
   * @param notice - Selected notice row.
   */
  const handleSelectNotice = useCallback(
    async (notice: TeamHubNotice): Promise<void> => {
      if (notice.readAt == null) {
        await onMarkRead(notice.id);
      }
      await onNavigate(notice);
      onDismiss();
    },
    [onDismiss, onMarkRead, onNavigate]
  );

  /**
   * Opens Settings → General focused on Team Hub notification preferences.
   */
  const handleOpenSettings = useCallback((): void => {
    dispatch(
      openPageTab({
        type: 'settings',
        section: 'general',
        focusSettingId: TEAM_HUB_NOTIFICATIONS_SETTING_ID
      })
    );
    onDismiss();
  }, [dispatch, onDismiss]);

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={`${hubName} notifications`}
      className="hc-team-hub-notices-panel fixed z-50 flex max-h-[min(70vh,28rem)] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-md border border-separator bg-surface shadow-md"
      style={{ left: menuPosition.x, top: menuPosition.y }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-separator px-3 py-2">
        <h2 className="m-0 text-[18px] font-semibold">{hubName}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-pointer rounded border-none bg-transparent px-2 py-1 text-[14px] text-accent hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Notification settings"
            onClick={handleOpenSettings}
          >
            Settings
          </button>
          <button
            type="button"
            className="cursor-pointer rounded border-none bg-transparent px-2 py-1 text-[14px] text-accent hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            disabled={bucket.unreadCount === 0}
            onClick={() => {
              void onMarkAllRead();
            }}
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" role="list" aria-busy={bucket.loading}>
        {showInitialLoading ? (
          <p className="m-0 px-3 py-4 text-muted" role="status" aria-live="polite">
            Loading notices…
          </p>
        ) : null}

        {!showInitialLoading && bucket.unsupported ? (
          <p className="m-0 px-3 py-4 text-muted" role="status">
            Notices are not available on this Team Hub yet.
          </p>
        ) : null}

        {!showInitialLoading && bucket.unreachable && !bucket.unsupported ? (
          <p className="m-0 px-3 py-4 text-muted" role="status">
            Team Hub is unreachable. Try again after reconnecting.
          </p>
        ) : null}

        {!showInitialLoading &&
        !bucket.unsupported &&
        !bucket.unreachable &&
        bucket.notices.length === 0 ? (
          <p className="m-0 px-3 py-4 text-muted" role="status">
            No notices yet.
          </p>
        ) : null}

        {!showInitialLoading
          ? bucket.notices.map((notice) => (
              <div key={notice.id} role="listitem">
                <TeamHubNoticeRow
                  notice={notice}
                  onSelect={() => {
                    void handleSelectNotice(notice);
                  }}
                />
              </div>
            ))
          : null}
      </div>

      {bucket.error != null ? (
        <p className="m-0 border-t border-separator px-3 py-2 text-danger" role="alert">
          {bucket.error}
        </p>
      ) : null}
    </div>
  );

  return portalToBody(panel);
}
