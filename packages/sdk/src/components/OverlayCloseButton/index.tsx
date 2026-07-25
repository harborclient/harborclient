import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

interface Props extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'children' | 'aria-label' | 'onClick' | 'aria-labelledby'
> {
  /**
   * Accessible name for the close control.
   */
  label?: string;

  /**
   * Called when the user activates the close button.
   */
  onClose: () => void;
}

/**
 * Always-visible overlay close icon used on full-page settings and plugin views.
 */
export function OverlayCloseButton({
  label = 'Close',
  onClose,
  className,
  ...props
}: Props): JSX.Element {
  return (
    <Button
      {...props}
      type="button"
      variant="icon"
      className={cn('hc-overlay-close-button text-[28px]', className)}
      aria-label={label}
      onClick={onClose}
    >
      <FaIcon icon={faXmark} className="hc-overlay-close-button-icon h-4 w-4" />
    </Button>
  );
}
