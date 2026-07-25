import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'title'> {
  /**
   * Id referenced by the dialog's `aria-labelledby`.
   */
  titleId: string;

  /**
   * Dialog heading rendered in the header row.
   */
  title: ReactNode;

  /**
   * Optional muted summary shown below the title.
   */
  description?: ReactNode;

  /**
   * Id referenced by the dialog's `aria-describedby` when `description` is set.
   */
  descriptionId?: string;

  /**
   * Extra action controls rendered before the Close button.
   */
  headerActions?: ReactNode;

  /**
   * When true, the header Close button is disabled.
   */
  closeDisabled?: boolean;

  /**
   * Closes the dialog from the header Close button.
   */
  onClose: () => void;
}

/**
 * Modal header row with a bordered bottom edge, title block on the left,
 * optional actions, and a close icon on the right.
 */
export function ModalHeader({
  titleId,
  title,
  description,
  descriptionId,
  headerActions,
  closeDisabled = false,
  onClose,
  className,
  ...props
}: Props): JSX.Element {
  return (
    <div
      {...props}
      className={cn(
        'hc-modal-header flex flex-wrap items-center gap-2 border-b border-separator px-4 py-4',
        className
      )}
    >
      <div className="hc-modal-header-content min-w-0 flex-1">
        <h2
          id={titleId}
          className="hc-modal-header-title m-0 flex flex-wrap items-center gap-2 text-[17px] font-semibold text-text"
        >
          {title}
        </h2>
        {description ? (
          <p
            id={descriptionId}
            className="hc-modal-header-description m-0 mt-1 text-[14px] text-muted"
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="hc-modal-header-actions flex flex-wrap items-center gap-2">
        {headerActions}
        <Button
          type="button"
          variant="icon"
          className="hc-modal-header-close shrink-0"
          aria-label="Close"
          disabled={closeDisabled}
          onClick={onClose}
        >
          <FaIcon icon={faXmark} className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
