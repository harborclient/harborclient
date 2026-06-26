import type { JSX, ReactNode } from 'react';

/**
 * Visual tone for compact status badges.
 */
export type BadgeVariant = 'success' | 'danger' | 'muted' | 'accent';

interface Props {
  /**
   * Badge label content.
   */
  children: ReactNode;

  /**
   * Color and background preset.
   */
  variant?: BadgeVariant;

  /**
   * Additional Tailwind classes merged onto the badge element.
   */
  className?: string;
}

/**
 * Returns background and text classes for the chosen badge variant.
 *
 * @param variant - Badge color preset.
 * @returns Tailwind classes for the badge span.
 */
function variantClasses(variant: BadgeVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-success/20 text-success';
    case 'danger':
      return 'bg-danger/20 text-danger';
    case 'accent':
      return 'bg-accent/20 text-accent';
    case 'muted':
    default:
      return 'bg-control text-muted';
  }
}

/**
 * Compact pill badge for status labels in lists and settings panels.
 *
 * @param children - Badge text.
 * @param variant - Color preset (`success`, `danger`, `muted`, or `accent`).
 * @param className - Extra classes appended after the variant preset.
 */
export function Badge({ children, variant = 'muted', className }: Props): JSX.Element {
  const base = `inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[14px] ${variantClasses(variant)}`;
  const classes = className ? `${base} ${className}` : base;

  return <span className={classes}>{children}</span>;
}
