import { useEffect, useRef, type JSX, type ReactNode } from 'react';
import { useDialogFocus } from '#/renderer/src/hooks/useDialogFocus';
import { ModalHeader } from '#/renderer/src/components/Modal/ModalHeader';

export { ModalFooter } from '#/renderer/src/components/Modal/ModalFooter';
export { ModalFormLayout } from '#/renderer/src/components/Modal/ModalFormLayout';

interface BaseProps {
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
  children
}: Props): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus(panelRef);

  /**
   * Closes the modal when Escape is pressed unless disabled.
   */
  useEffect(() => {
    if (disableEscape) return;

    /**
     * Dismisses the dialog on Escape key press.
     *
     * @param event - Document keydown event.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [disableEscape, onClose]);

  const overlayClass = `fixed inset-0 flex items-center justify-center bg-black/40 ${overlayClassName ?? 'z-50'}`;

  const panelClass = title
    ? `${className} flex max-h-[85vh] flex-col overflow-hidden rounded-lg border border-separator bg-surface shadow-xl`
    : `${className} rounded-lg border border-separator bg-surface p-4 shadow-xl`;

  return (
    <div className={overlayClass} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        className={panelClass}
        onClick={(event) => event.stopPropagation()}
      >
        {title && labelledBy ? (
          <>
            <ModalHeader
              titleId={labelledBy}
              title={title}
              description={description}
              headerActions={headerActions}
              closeDisabled={closeDisabled}
              onClose={onClose}
            />
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
