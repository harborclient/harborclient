import type { JSX } from 'react';
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
export function Footer({ consoleOpen, entryCount, onToggleConsole }: Props): JSX.Element {
  return (
    <footer className="flex shrink-0 items-center border-t border-separator bg-control px-2 py-0.5 app-no-drag">
      <div className={segmentGroup}>
        <button className={footerSegment(consoleOpen)} onClick={onToggleConsole}>
          Console
          {entryCount > 0 && <span className="ml-1 text-[11px] text-muted">({entryCount})</span>}
        </button>
      </div>
    </footer>
  );
}
