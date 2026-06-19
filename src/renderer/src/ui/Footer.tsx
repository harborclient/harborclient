import type { JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faSidebar } from '#/renderer/src/fontawesome';
import { segmentGroup } from './classes';

interface Props {
  /**
   * Whether the console panel is currently open.
   */
  consoleOpen: boolean;

  /**
   * Number of entries in the console log.
   */
  entryCount: number;

  /**
   * Toggles the console panel open/closed.
   */
  onToggleConsole: () => void;

  /**
   * Whether the sidebar is currently visible.
   */
  sidebarOpen: boolean;

  /**
   * Toggles the sidebar visible/hidden.
   */
  onToggleSidebar: () => void;
}

/**
 * Compact segment button styles for the footer bar.
 */
function footerSegment(active: boolean): string {
  return active
    ? 'cursor-pointer rounded-[5px] border-none bg-surface px-2 py-0.5 text-[12px] text-text shadow-sm app-no-drag'
    : 'cursor-pointer rounded-[5px] border-none bg-transparent px-2 py-0.5 text-[12px] text-muted hover:text-text app-no-drag';
}

/**
 * Persistent window footer with a Console toggle.
 */
export function Footer({
  consoleOpen,
  entryCount,
  onToggleConsole,
  sidebarOpen,
  onToggleSidebar
}: Props): JSX.Element {
  return (
    <footer className="flex shrink-0 items-center justify-between border-t border-separator bg-control px-2 py-0.5 app-no-drag">
      <div className={segmentGroup}>
        <button className={footerSegment(consoleOpen)} onClick={onToggleConsole}>
          Console
          {entryCount > 0 && <span className="ml-1 text-[11px] text-muted">({entryCount})</span>}
        </button>
      </div>
      <button
        type="button"
        className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted hover:bg-selection hover:text-text app-no-drag"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        <FaIcon icon={faSidebar} className="h-3.5 w-3.5" />
      </button>
    </footer>
  );
}
