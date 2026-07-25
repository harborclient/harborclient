import type { ComponentPropsWithoutRef, JSX, Ref } from 'react';
import { cn } from '../utils.js';
import { radioCircle, radioDot, radioInput } from './classes.js';

interface Props extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'ref' | 'className'> {
  /**
   * Additional Tailwind classes applied to the outer wrapper.
   */
  className?: string;

  /**
   * Ref forwarded to the underlying native radio input.
   */
  ref?: Ref<HTMLInputElement>;
}

/**
 * macOS-style radio button with a custom circle slightly larger than the native control.
 */
export function Radio({ ref, className, ...props }: Props): JSX.Element {
  return (
    <span
      className={cn(
        'hc-radio relative inline-flex h-[18px] w-[18px] shrink-0 leading-none',
        className
      )}
    >
      <input {...props} ref={ref} type="radio" className={cn('hc-radio-input', radioInput)} />
      <span className={cn('hc-radio-circle', radioCircle)} aria-hidden>
        <span className={cn('hc-radio-dot', radioDot)} />
      </span>
    </span>
  );
}
