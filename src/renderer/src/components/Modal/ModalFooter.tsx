import type { JSX, ReactNode } from 'react';

interface Props {
  /**
   * Action buttons rendered in a right-aligned row.
   */
  children: ReactNode;

  /**
   * When true, adds top margin before the action row (common in modal bodies).
   */
  spaced?: boolean;

  /**
   * Additional Tailwind classes merged onto the footer row.
   */
  className?: string;
}

/**
 * Right-aligned action button row for modal bodies and overlay footers.
 *
 * @param children - Cancel, confirm, and other action controls.
 * @param spaced - Whether to add `mt-4` above the button row.
 * @param className - Extra classes appended after the layout preset.
 */
export function ModalFooter({ children, spaced = false, className }: Props): JSX.Element {
  const base = spaced ? 'mt-4 flex justify-end gap-2' : 'flex justify-end gap-2';
  const classes = className ? `${base} ${className}` : base;

  return <div className={classes}>{children}</div>;
}
