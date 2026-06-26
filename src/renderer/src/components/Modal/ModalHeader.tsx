import type { JSX, ReactNode } from 'react';
import { Button } from '#/renderer/src/components/Button';

interface Props {
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
 * optional actions, and a primary Close button on the right.
 */
export function ModalHeader({
  titleId,
  title,
  description,
  headerActions,
  closeDisabled = false,
  onClose
}: Props): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-separator px-4 py-4">
      <div className="min-w-0 flex-1">
        <h2
          id={titleId}
          className="m-0 flex flex-wrap items-center gap-2 text-[17px] font-semibold text-text"
        >
          {title}
        </h2>
        {description ? <p className="m-0 mt-1 text-[14px] text-muted">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {headerActions}
        <Button
          type="button"
          className="shrink-0 whitespace-nowrap"
          aria-label="Close"
          disabled={closeDisabled}
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  );
}
