import type { JSX, ReactNode } from 'react';

type EmptyStateVariant = 'inline' | 'centered';

interface Props {
  /**
   * Empty-state message content.
   */
  children: ReactNode;

  /**
   * Layout preset; centered fills available space in panel bodies.
   */
  variant?: EmptyStateVariant;

  /**
   * Additional Tailwind classes merged onto the wrapper element.
   */
  className?: string;
}

/**
 * Returns layout classes for inline or centered empty placeholders.
 *
 * @param variant - Empty state layout preset.
 * @returns Tailwind classes for the wrapper.
 */
function variantClasses(variant: EmptyStateVariant): string {
  if (variant === 'centered') {
    return 'flex flex-1 items-center justify-center p-4 text-center text-[14px] text-muted';
  }
  return 'text-[14px] text-muted';
}

/**
 * Placeholder shown when a panel or list has no content to display.
 *
 * @param children - Empty message text or markup.
 * @param variant - Layout preset (`inline` or `centered`).
 * @param className - Extra classes appended after the preset.
 */
export function EmptyState({ children, variant = 'inline', className }: Props): JSX.Element {
  const base = variantClasses(variant);
  const classes = className ? `${base} ${className}` : base;

  return <div className={classes}>{children}</div>;
}
