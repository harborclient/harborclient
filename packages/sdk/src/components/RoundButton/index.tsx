import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { footerPanelCloseButtonClassName } from '../Resizable/footerPanelUtils.js';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  /**
   * Font Awesome icon shown inside the round button.
   */
  icon: IconDefinition;

  /**
   * Accessible name for the button.
   */
  ariaLabel: string;

  /**
   * Optional tooltip text. Defaults to `ariaLabel`.
   */
  title?: string;
}

/**
 * Round icon button for compact toolbars and panel chrome.
 */
export function RoundButton({
  icon,
  ariaLabel,
  title,
  className,
  onClick,
  ...props
}: Props): JSX.Element {
  return (
    <button
      {...props}
      type="button"
      className={cn(
        'hc-round-button focus-visible:bg-selection focus-visible:text-text',
        footerPanelCloseButtonClassName,
        className
      )}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      <FaIcon icon={icon} className="hc-round-button-icon h-3.5 w-3.5" />
    </button>
  );
}
