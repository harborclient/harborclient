import { faPlus } from '@fortawesome/free-solid-svg-icons';
import type { JSX } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { tabItem } from '../classes.js';
import { cn } from '../utils.js';

interface Props {
  /**
   * Accessible name for the new-tab control.
   */
  ariaLabel: string;

  /**
   * Native tooltip text for the new-tab control.
   */
  title: string;

  /**
   * When true, renders a tab-height slot for wrapped tab lists; otherwise uses
   * the compact circular control for horizontal scroll mode.
   */
  wrapped: boolean;

  /**
   * Called when the user opens a new tab or chat.
   */
  onClick: () => void;
}

/**
 * New-tab "+" control shared by request editor and AI chat tab bars.
 */
export function TabNewButton({ ariaLabel, title, wrapped, onClick }: Props): JSX.Element {
  if (wrapped) {
    return (
      <div className="flex shrink-0">
        <button
          type="button"
          className={cn(
            'app-no-drag -mb-1 inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center self-end rounded-t-lg border border-b-2 px-3 text-[14px]',
            tabItem(false)
          )}
          title={title}
          aria-label={ariaLabel}
          onClick={onClick}
        >
          <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="-mb-1 flex shrink-0 items-end px-1">
      <button
        type="button"
        className="hc-tab-new-button app-no-drag mb-2.5 inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-[14px] text-muted hover:bg-selection hover:text-text focus-visible:bg-selection focus-visible:text-text"
        title={title}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
