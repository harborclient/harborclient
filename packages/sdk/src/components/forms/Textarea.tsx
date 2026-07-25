import type { ComponentPropsWithoutRef, JSX, Ref } from 'react';
import { type FieldVariant, mergeFieldClasses } from './classes.js';

interface Props extends Omit<ComponentPropsWithoutRef<'textarea'>, 'ref'> {
  /**
   * Base field styling preset.
   */
  variant?: FieldVariant;

  /**
   * Additional Tailwind classes merged after the variant preset.
   */
  className?: string;

  /**
   * Ref forwarded to the underlying native textarea.
   */
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * macOS-style multiline input with shared field styling presets.
 */
export function Textarea({ ref, variant = 'control', className, ...props }: Props): JSX.Element {
  return (
    <textarea
      ref={ref}
      className={mergeFieldClasses(variant, className, 'hc-textarea')}
      {...props}
    />
  );
}
