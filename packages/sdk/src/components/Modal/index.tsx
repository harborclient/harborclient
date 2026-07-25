import { useEffect, useRef } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { useDialogFocus } from '../useDialogFocus.js';
import { cn } from '../utils.js';
import { ModalHeader } from './ModalHeader.js';

export { ModalFooter } from './ModalFooter.js';
export { ModalFormLayout } from './ModalFormLayout.js';

interface BaseProps extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'className' | 'title'
> {
  /**
   * Called when the backdrop is clicked or Escape is pressed.
   */
  onClose: () => void;

  /**
   * Optional width class for the dialog panel (defaults to w-96).
   */
  className?: string;

  /**
   * Optional classes merged onto the backdrop overlay.
   */
  overlayClassName?: string;

  /**
   * When true, Escape does not call `onClose` (e.g. modals that require an explicit button).
   */
  disableEscape?: boolean;

  /**
   * Dialog heading rendered in the modal header row.
   */
  title?: ReactNode;

  /**
   * Optional muted summary shown below the title in the header.
   */
  description?: ReactNode;

  /**
   * Extra action controls rendered before the header Close button.
   */
  headerActions?: ReactNode;

  /**
   * When true, the header Close button is disabled.
   */
  closeDisabled?: boolean;

  /**
   * Children to render inside the modal body.
   */
  children: ReactNode;
}

type Props = BaseProps &
  (
    | {
        /**
         * Id of the element that labels the dialog (typically the heading).
         */
        labelledBy: string;
        label?: never;
      }
    | {
        labelledBy?: never;
        /**
         * Accessible name when no visible heading is linked via `labelledBy`.
         */
        label: string;
      }
  );

/**
 * Shared modal backdrop and panel wrapper used by all application dialogs.
 */
export function Modal({
  onClose,
  className = 'w-96',
  overlayClassName,
  disableEscape = false,
  title,
  description,
  headerActions,
  closeDisabled = false,
  labelledBy,
  label,
  children,
  ...props
}: Props): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useDialogFocus(overlayRef);

  /**
   * Closes the modal when Escape is pressed unless disabled.
   */
  useEffect(() => {
    if (disableEscape) return;

    /**
     * Dismisses the dialog on Escape key press.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [disableEscape, onClose]);

  const overlayClass = cn(
    'hc-modal fixed inset-0 flex items-center justify-center bg-black/40',
    overlayClassName ?? 'z-50'
  );

  const panelClass = title
    ? cn(
        className,
        'flex max-h-[85vh] flex-col overflow-hidden rounded-lg border border-separator bg-surface shadow-xl'
      )
    : cn(className, 'rounded-lg border border-separator bg-surface p-4 shadow-xl');

  const descriptionId = description && labelledBy ? `${labelledBy}-description` : undefined;

  return (
    <div ref={overlayRef} {...props} className={overlayClass}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={descriptionId}
        aria-label={label}
        className={cn('hc-modal-panel relative z-10', panelClass)}
        onClick={(event) => event.stopPropagation()}
      >
        {title && labelledBy ? (
          <>
            <ModalHeader
              titleId={labelledBy}
              title={title}
              description={description}
              descriptionId={descriptionId}
              headerActions={headerActions}
              closeDisabled={closeDisabled}
              onClose={onClose}
            />
            <div className="hc-modal-body flex-1 overflow-y-auto p-4">{children}</div>
          </>
        ) : (
          children
        )}
      </div>
      <button
        type="button"
        tabIndex={-1}
        className="hc-modal-backdrop absolute inset-0 z-0 cursor-default border-none bg-transparent p-0"
        aria-label="Close dialog"
        onClick={onClose}
      />
    </div>
  );
}
