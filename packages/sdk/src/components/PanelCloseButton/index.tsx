import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  /**
   * Default accessible name when `ariaLabel` is not provided.
   */
  label?: string;

  /**
   * Accessible name when it should differ from `label`.
   */
  ariaLabel?: string;

  /**
   * Called when the user closes the panel or overlay.
   */
  onClose: () => void;
}

/**
 * Secondary icon close control for settings headers and full-page panels.
 */
export function PanelCloseButton({
  onClose,
  label = 'Close',
  ariaLabel,
  className,
  ...props
}: Props): JSX.Element {
  return (
    <Button
      {...props}
      type="button"
      variant="secondary"
      className={cn(
        'hc-panel-close-button inline-flex shrink-0 items-center justify-center py-2',
        className
      )}
      aria-label={ariaLabel ?? label}
      onClick={onClose}
    >
      <FaIcon icon={faXmark} className="hc-panel-close-button-icon h-4 w-4" />
    </Button>
  );
}
