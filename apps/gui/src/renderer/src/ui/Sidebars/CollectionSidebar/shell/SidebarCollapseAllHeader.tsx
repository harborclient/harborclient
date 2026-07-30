import { type JSX } from 'react';
import { FaIcon } from '@harborclient/sdk/components';
import { faSquareMinus } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Invoked when the collapse-all control is activated.
   */
  onClick: () => void;

  /**
   * Accessible name for the control. Defaults to "Collapse all".
   */
  ariaLabel?: string;

  /**
   * Tooltip text for the control.
   */
  title?: string;
}

/**
 * Full-width section-style header row above the rail and accordion that hosts
 * only the collapse-all action, right-aligned to match section header action buttons.
 *
 * @param props - Click handler and optional accessible labels.
 */
export function SidebarCollapseAllHeader({
  onClick,
  ariaLabel = 'Collapse all',
  title = 'Collapse all collections, folders, and sections'
}: Props): JSX.Element {
  return (
    <div className="hc-sidebar-section-header flex min-h-8 shrink-0 items-center justify-end gap-2 bg-sidebar-section py-1 pl-0.5 pr-2.5">
      <div className="hc-sidebar-section-header-actions flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="hc-sidebar-add-button app-no-drag inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted hover:bg-selection hover:text-text focus-visible:bg-selection focus-visible:text-text me-1"
          aria-label={ariaLabel}
          title={title}
          onClick={onClick}
        >
          <FaIcon icon={faSquareMinus} className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
