import type { JSX, ReactNode } from 'react';
import { OverlayCloseButton } from '#/renderer/src/components/OverlayCloseButton';

interface Props {
  /**
   * Page title shown in the overlay header.
   */
  title: ReactNode;

  /**
   * Called when the user closes the overlay.
   */
  onClose: () => void;

  /**
   * Scrollable page body content.
   */
  children: ReactNode;

  /**
   * Optional footer actions such as Save/Cancel rows.
   */
  footer?: ReactNode;

  /**
   * Accessible name for the header close button.
   */
  closeLabel?: string;

  /**
   * Additional Tailwind classes merged onto the outer scroll container.
   */
  className?: string;
}

/**
 * Full-page scrollable overlay shell shared by environment, collection, and plugin views.
 *
 * @param title - Header title text or element.
 * @param onClose - Close handler for the header button.
 * @param children - Main page content.
 * @param footer - Optional trailing action row below the body.
 * @param closeLabel - Accessible close button label.
 * @param className - Extra classes on the outer container.
 */
export function OverlayPage({
  title,
  onClose,
  children,
  footer,
  closeLabel,
  className
}: Props): JSX.Element {
  const outer = className
    ? `flex min-h-0 flex-1 flex-col overflow-y-auto p-6 ${className}`
    : 'flex min-h-0 flex-1 flex-col overflow-y-auto p-6';

  return (
    <div className={outer}>
      <div className="mx-auto w-full">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="m-0 text-[15px] font-semibold text-text">{title}</h1>
          <OverlayCloseButton label={closeLabel} onClose={onClose} />
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
