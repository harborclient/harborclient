import type { JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';

interface Props {
  /**
   * Called when the user closes the panel or overlay.
   */
  onClose: () => void;

  /**
   * Visible button label.
   */
  label?: string;

  /**
   * Accessible name when it should differ from the visible label.
   */
  ariaLabel?: string;

  /**
   * Additional Tailwind classes merged onto the button element.
   */
  className?: string;
}

/**
 * Text Close control for settings headers and full-page panels.
 *
 * @param onClose - Close handler.
 * @param label - Visible button text; defaults to "Close".
 * @param ariaLabel - Accessible name override.
 * @param className - Extra classes appended after the shrink preset.
 */
export function PanelCloseButton({
  onClose,
  label = 'Close',
  ariaLabel,
  className
}: Props): JSX.Element {
  const base = 'shrink-0 whitespace-nowrap';
  const classes = className ? `${base} ${className}` : base;

  return (
    <Button type="button" className={classes} aria-label={ariaLabel ?? label} onClick={onClose}>
      {label}
    </Button>
  );
}
