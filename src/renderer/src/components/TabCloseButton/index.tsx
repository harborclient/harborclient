import type { JSX } from 'react';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FaIcon } from '#/renderer/src/components/FaIcon';

interface Props {
  /**
   * Accessible name for the close control, typically including the tab title.
   */
  ariaLabel: string;

  /**
   * Called when the user activates the close button.
   */
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /**
   * Optional tooltip label; defaults to "Close tab".
   */
  title?: string;
}

/**
 * Hover-reveal close control for document-style tabs in the request editor and AI chat.
 *
 * @param ariaLabel - Accessible name describing which tab closes.
 * @param onClick - Click handler; callers should stop propagation when needed.
 * @param title - Optional native tooltip text.
 */
export function TabCloseButton({ ariaLabel, onClick, title = 'Close tab' }: Props): JSX.Element {
  return (
    <button
      type="button"
      className="inline-flex aspect-square shrink-0 cursor-pointer items-center justify-center self-stretch rounded-md border-none bg-transparent text-[14px] text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:opacity-100 hover:bg-selection hover:text-text app-no-drag"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
    </button>
  );
}
