import type { JSX, ReactNode } from 'react';

/**
 * Vertical spacing preset for inline error text.
 */
export type FieldErrorSpacing = 'field' | 'section' | 'modal';

interface Props {
  /**
   * Error message content. When empty, nothing is rendered.
   */
  children?: ReactNode;

  /**
   * Element id referenced by `aria-describedby` on the related control.
   */
  id?: string;

  /**
   * Margin preset matching common form, section, and modal layouts.
   */
  spacing?: FieldErrorSpacing;

  /**
   * When true, exposes the message as an alert for assistive technologies.
   */
  roleAlert?: boolean;

  /**
   * Additional Tailwind classes merged onto the error paragraph.
   */
  className?: string;
}

/**
 * Returns margin classes for the chosen error spacing preset.
 *
 * @param spacing - Vertical spacing preset.
 * @returns Tailwind margin classes for the error paragraph.
 */
function spacingClasses(spacing: FieldErrorSpacing): string {
  switch (spacing) {
    case 'section':
      return 'mt-3';
    case 'modal':
      return 'mt-4';
    case 'field':
    default:
      return 'mt-1';
  }
}

/**
 * Accessible inline validation or error text with consistent typography and spacing.
 *
 * @param children - Error message; omitted or empty values render nothing.
 * @param id - Optional id for `aria-describedby` linkage.
 * @param spacing - Margin preset (`field`, `section`, or `modal`).
 * @param roleAlert - Whether to set `role="alert"`.
 * @param className - Extra classes appended after the preset.
 */
export function FieldError({
  children,
  id,
  spacing = 'field',
  roleAlert = false,
  className
}: Props): JSX.Element | null {
  if (children == null || children === '') return null;

  const base = `${spacingClasses(spacing)} text-[14px] text-danger`;
  const classes = className ? `${base} ${className}` : base;

  return (
    <p id={id} className={classes} role={roleAlert ? 'alert' : undefined}>
      {children}
    </p>
  );
}
