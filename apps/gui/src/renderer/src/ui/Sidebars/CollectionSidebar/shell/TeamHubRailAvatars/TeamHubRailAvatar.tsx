import { type JSX } from 'react';
import { teamHubAvatarColorClass, teamHubInitials } from './teamHubInitials';

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
   * Display name used for initials (session user, persisted user, or hub name).
   */
  displayName: string;

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
   * Called when the user activates the avatar to toggle connection.
   */
  onToggle: () => void;
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
 * or grey status dot indicates whether the hub is currently reachable.
 *
 * @param props - Hub identity, connection/online state, and toggle handler.
 */
export function TeamHubRailAvatar({
  hubId,
  hubName,
  displayName,
  connected,
  online,
  expanded,
  onToggle
}: Props): JSX.Element {
  const initials = teamHubInitials(displayName);
  const statusLabel = connected ? 'connected' : 'disconnected';
  const ariaLabel = `${hubName}, ${statusLabel}`;
  const showOnlineDot = connected && online;
  const tileColorClass = connected
    ? teamHubAvatarColorClass(hubId)
    : 'bg-muted text-muted opacity-50 grayscale';

  return (
    <button
      type="button"
      className={`hc-team-hub-rail-avatar inline-flex w-full cursor-pointer items-center rounded-none border-none bg-transparent text-sidebar-rail-text hover:bg-sidebar-rail-active ${
        expanded ? 'gap-2 px-3 py-1' : 'justify-center'
      } ${avatarFocusVisible}`}
      aria-label={ariaLabel}
      aria-pressed={connected}
      title={hubName}
      onClick={onToggle}
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
