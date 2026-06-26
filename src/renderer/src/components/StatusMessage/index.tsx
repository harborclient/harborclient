import type { JSX, ReactNode } from 'react';

interface Props {
  /**
   * Status or helper text content.
   */
  children: ReactNode;

  /**
   * When true, exposes the message as a live region for assistive technologies.
   */
  live?: boolean;

  /**
   * Optional element id for `aria-describedby` linkage.
   */
  id?: string;

  /**
   * Additional Tailwind classes merged onto the status paragraph.
   */
  className?: string;
}

/**
 * Muted helper or progress text with optional polite live-region semantics.
 *
 * @param children - Status message content.
 * @param live - Whether to set `role="status"` and `aria-live="polite"`.
 * @param className - Extra classes appended after the preset.
 */
export function StatusMessage({ children, live = true, id, className }: Props): JSX.Element {
  const base = 'text-[14px] text-muted';
  const classes = className ? `${base} ${className}` : base;

  return (
    <p
      id={id}
      className={classes}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
    >
      {children}
    </p>
  );
}
