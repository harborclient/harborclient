import type { ComponentPropsWithoutRef, JSX, Ref } from 'react';
import { type FieldVariant, mergeFieldClasses } from './classes.js';

interface Props extends Omit<ComponentPropsWithoutRef<'input'>, 'ref'> {
  /**
   * Base field styling preset. Checkbox and radio inputs default to `plain`.
   */
  variant?: FieldVariant;

  /**
   * Additional Tailwind classes merged after the variant preset.
   */
  className?: string;

  /**
   * Ref forwarded to the underlying native input.
   */
  ref?: Ref<HTMLInputElement>;
}

/**
 * macOS-style text and choice input with shared field styling presets.
 */
export function Input({ ref, variant = 'control', type, className, ...props }: Props): JSX.Element {
  const resolvedVariant = type === 'checkbox' || type === 'radio' ? 'plain' : variant;

  return (
    <input
      ref={ref}
      type={type}
      className={mergeFieldClasses(resolvedVariant, className, 'hc-input')}
      {...props}
    />
  );
}
