import { faAngleLeft } from '@fortawesome/free-solid-svg-icons';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  /**
   * Visible button text and default accessible name when `ariaLabel` is not provided.
   */
  label?: string;

  /**
   * Accessible name when it should differ from the visible `label`.
   */
  ariaLabel?: string;
}

/**
 * Secondary back control for nested panel and overlay headers.
 *
 * Matches {@link PanelCloseButton} sizing with a left-angle icon and visible label.
 */
export function BackButton({
  onClick,
  label = 'Back',
  ariaLabel,
  className,
  ...props
}: Props): JSX.Element {
  return (
    <Button
      {...props}
      type="button"
      variant="toolbar"
      className={cn(
        'hc-back-button inline-flex h-6 shrink-0 items-center justify-center gap-1.5 py-1 text-[14px]',
        className
      )}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <FaIcon icon={faAngleLeft} className="hc-back-button-icon h-4 w-4" aria-hidden />
      <span>{label}</span>
    </Button>
  );
}
