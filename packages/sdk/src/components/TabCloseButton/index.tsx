import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { ComponentPropsWithoutRef, JSX, MouseEvent } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  /**
   * Accessible name for the close control, typically including the tab title.
   */
  ariaLabel: string;

  /**
   * Called when the user activates the close button.
   */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;

  /**
   * Optional tooltip label; defaults to "Close tab".
   */
  title?: string;
}

/**
 * Close control for document-style tabs in the request editor and AI chat.
 */
export function TabCloseButton({
  ariaLabel,
  onClick,
  title = 'Close tab',
  tabIndex,
  className,
  ...props
}: Props): JSX.Element {
  return (
    <button
      {...props}
      type="button"
      className={cn(
        'hc-tab-close-button app-no-drag inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center self-center rounded-full border-none bg-transparent text-[14px] text-muted hover:bg-selection hover:text-text focus-visible:bg-selection focus-visible:text-text',
        className
      )}
      title={title}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      onClick={onClick}
    >
      <FaIcon icon={faXmark} className="hc-tab-close-button-icon h-3.5 w-3.5" />
    </button>
  );
}
