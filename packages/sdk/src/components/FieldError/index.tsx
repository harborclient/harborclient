import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

/**
 * Vertical spacing preset for inline error text.
 */
export type FieldErrorSpacing = 'field' | 'section' | 'modal';

interface Props extends Omit<ComponentPropsWithoutRef<'p'>, 'children'> {
  /**
   * Error message content. When empty, nothing is rendered.
   */
  children?: ReactNode;

  /**
   * Margin preset matching common form, section, and modal layouts.
   */
  spacing?: FieldErrorSpacing;

  /**
   * When true, exposes the message as an alert for assistive technologies.
   */
  roleAlert?: boolean;
}

/**
 * Returns margin classes for the chosen error spacing preset.
 *
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
 */
export function FieldError({
  children,
  spacing = 'field',
  roleAlert = true,
  className,
  ...props
}: Props): JSX.Element | null {
  if (children == null || children === '') return null;

  return (
    <p
      {...props}
      className={cn('hc-field-error text-[14px] text-danger', spacingClasses(spacing), className)}
      role={roleAlert ? 'alert' : undefined}
    >
      {children}
    </p>
  );
}
