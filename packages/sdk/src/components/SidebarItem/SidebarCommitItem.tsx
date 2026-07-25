import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, MouseEvent } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { SidebarStatusDot } from './SidebarStatusDot.js';

/**
 * Push/sync state shown as a dot below the branch icon.
 */
export type SidebarCommitPushStatus = 'pushed' | 'unpushed' | 'unknown';

interface Props {
  /**
   * Commit message shown as the primary line.
   */
  message: string;

  /**
   * Author name shown in the metadata line.
   */
  author: string;

  /**
   * Formatted timestamp string shown in the metadata line.
   */
  timestampLabel: string;

  /**
   * Branch icon shown before the commit text.
   */
  icon: IconDefinition;

  /**
   * Push/sync state shown as a dot below the branch icon.
   * When omitted, no indicator is rendered (non-git contexts).
   */
  pushStatus?: SidebarCommitPushStatus;

  /**
   * Called when the commit row button is clicked.
   */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;

  /**
   * HTML element for the row container. Use `li` inside {@link SidebarList}.
   */
  as?: 'div' | 'li';
}

/**
 * Returns the screen-reader label for a commit push-status indicator.
 *
 * @param pushStatus - Push state to describe.
 * @returns Accessible label text for the status dot.
 */
function pushStatusLabel(pushStatus: SidebarCommitPushStatus): string {
  if (pushStatus === 'pushed') {
    return 'Pushed to origin';
  }
  if (pushStatus === 'unpushed') {
    return 'Not pushed to origin';
  }
  return 'Push status unknown';
}

/**
 * Renders a recent commit row in the Git sidebar Commits section.
 * Uses a distinct two-line layout rather than the standard sourceRow shell.
 *
 * Wrap lists in {@link SidebarList} and pass `as="li"` for valid list semantics.
 */
export function SidebarCommitItem({
  message,
  author,
  timestampLabel,
  icon,
  pushStatus,
  onClick,
  as: Container = 'li'
}: Props): JSX.Element {
  const statusLabel = pushStatus != null ? pushStatusLabel(pushStatus) : null;

  return (
    <Container>
      <button
        type="button"
        className="hc-sidebar-commit-item group app-no-drag flex w-full cursor-pointer rounded-md p-2 text-left hover:bg-selection/60"
        onClick={onClick}
      >
        <div className="mr-2 flex shrink-0 flex-col items-center gap-0.5 self-start">
          <FaIcon icon={icon} className="h-4 w-4 text-muted" aria-hidden />
          {pushStatus != null && statusLabel != null ? (
            <SidebarStatusDot
              className={pushStatus === 'pushed' ? 'mt-3 mr-1 bg-success' : 'mt-3 mr-1 bg-muted'}
              srOnlyLabel={statusLabel}
              title={statusLabel}
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="-mt-1 block min-w-0 truncate font-medium text-text">{message}</span>
          <span className="block min-w-0 truncate text-[14px] text-muted">
            {author} · {timestampLabel}
          </span>
        </div>
      </button>
    </Container>
  );
}
