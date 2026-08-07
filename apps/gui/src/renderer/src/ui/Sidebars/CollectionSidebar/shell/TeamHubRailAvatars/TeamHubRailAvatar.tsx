import { type JSX } from 'react';
import type { TeamHubAvatar } from '@harborclient/core/types';
import {
  teamHubAvatarColorClass,
  teamHubAvatarColorClassFromKey,
  teamHubInitials
} from './teamHubInitials';
import { formatNoticeBadgeCount } from './formatNoticeBadgeCount';

interface Props {
  /**
   * Team hub connection id used for color hashing and callbacks.
   */
  hubId: string;

  /**
   * Connection display name shown in the expanded rail and tooltips.
   */
  hubName: string;

  /**
   * Optional server-provided hub avatar metadata from session introspection.
   */
  hubAvatar?: TeamHubAvatar;

  /**
   * Fallback display name used for initials when server avatar metadata is absent.
   */
  fallbackDisplayName: string;

  /**
   * Whether the hub is soft-connected (backend mounted).
   */
  connected: boolean;

  /**
   * Whether the hub server responded successfully to the latest session scan.
   */
  online: boolean;

  /**
   * When true, shows the hub name beside the avatar tile.
   */
  expanded: boolean;

  /**
   * Unread notice count for badge display.
   */
  unreadNoticeCount?: number;

  /**
   * When true, clicking the avatar opens the notices dropdown instead of toggling connection.
   */
  noticesEnabled?: boolean;

  /**
   * Registers the avatar button element for anchoring the notices dropdown.
   */
  registerAnchor?: (element: HTMLButtonElement | null) => void;

  /**
   * Called when the user activates the avatar to toggle connection.
   */
  onToggle: () => void;

  /**
   * Called when the user opens the notices dropdown from the avatar or badge.
   */
  onOpenNotices?: () => void;
}

/**
 * Shared focus-visible outline matching other rail footer controls.
 */
const avatarFocusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent';

/**
 * Square initials avatar for one Team Hub in the sidebar rail footer.
 *
 * Connected hubs use a solid color tile; disconnected hubs are muted. A green
 * or grey status dot indicates whether the hub is currently reachable. When
 * notices are enabled, an unread badge appears on the avatar tile.
 *
 * Prefers server-provided hub avatar initials and color when available.
 *
 * @param props - Hub identity, connection/online state, and toggle handler.
 */
export function TeamHubRailAvatar({
  hubId,
  hubName,
  hubAvatar,
  fallbackDisplayName,
  connected,
  online,
  expanded,
  unreadNoticeCount = 0,
  noticesEnabled = false,
  registerAnchor,
  onToggle,
  onOpenNotices
}: Props): JSX.Element {
  const initials = hubAvatar?.initials ?? teamHubInitials(fallbackDisplayName);
  const statusLabel = connected ? 'connected' : 'disconnected';
  const badgeLabel = formatNoticeBadgeCount(unreadNoticeCount);
  const noticesLabel =
    badgeLabel != null
      ? `${hubName}, ${statusLabel}, ${badgeLabel} unread notices`
      : `${hubName}, ${statusLabel}, open notifications`;
  const ariaLabel = noticesEnabled ? noticesLabel : `${hubName}, ${statusLabel}`;
  const showOnlineDot = connected && online;
  const tileColorClass = connected
    ? hubAvatar?.color
      ? teamHubAvatarColorClassFromKey(hubAvatar.color, hubId)
      : teamHubAvatarColorClass(hubId)
    : 'bg-muted text-muted opacity-50 grayscale';

  /**
   * Opens notices when enabled; otherwise toggles hub connection state.
   */
  const handleClick = (): void => {
    if (noticesEnabled && onOpenNotices) {
      onOpenNotices();
      return;
    }
    onToggle();
  };

  return (
    <button
      ref={registerAnchor}
      type="button"
      className={`hc-team-hub-rail-avatar inline-flex w-full cursor-pointer items-center rounded-none border-none bg-transparent text-sidebar-rail-text hover:bg-sidebar-rail-active ${
        expanded ? 'gap-2 px-3 py-1' : 'justify-center'
      } ${avatarFocusVisible}`}
      aria-label={ariaLabel}
      aria-pressed={connected}
      title={hubName}
      onClick={handleClick}
    >
      <span
        className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center ${
          expanded ? 'my-2' : 'm-4'
        }`}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-md text-[14px] font-semibold text-white ${tileColorClass}`}
          aria-hidden
        >
          {initials}
        </span>
        {badgeLabel != null ? (
          <span
            className="absolute -top-1 -right-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[14px] font-semibold text-white ring-2 ring-sidebar-rail"
            aria-hidden
          >
            {badgeLabel}
          </span>
        ) : null}
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-sidebar-rail ${
            showOnlineDot ? 'bg-success' : 'bg-muted'
          }`}
          aria-hidden
        />
      </span>
      {expanded ? <span className="min-w-0 truncate text-left">{hubName}</span> : null}
    </button>
  );
}
