import type { JSX } from 'react';
import { faAngleLeft } from '@fortawesome/free-solid-svg-icons';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';

interface Props {
  /**
   * Called when the user activates the back control.
   */
  onClick: () => void;

  /**
   * Visible button label.
   */
  label?: string;

  /**
   * Additional Tailwind classes merged onto the button element.
   */
  className?: string;
}

/**
 * Secondary navigation control that returns to the previous Team Hub or settings view.
 *
 * @param onClick - Back navigation handler.
 * @param label - Visible label; defaults to "Back".
 * @param className - Extra classes appended after the preset.
 */
export function BackButton({ onClick, label = 'Back', className }: Props): JSX.Element {
  return (
    <Button type="button" variant="secondary" className={className} onClick={onClick}>
      <FaIcon icon={faAngleLeft} className="mr-1" />
      {label}
    </Button>
  );
}
