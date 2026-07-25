import type { ComponentPropsWithoutRef, JSX, Ref } from 'react';
import { cn } from '../utils.js';
import { checkboxBox, checkboxInput } from './classes.js';

interface Props extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'ref' | 'className'> {
  /**
   * Additional Tailwind classes applied to the outer wrapper.
   */
  className?: string;

  /**
   * Ref forwarded to the underlying native checkbox input.
   */
  ref?: Ref<HTMLInputElement>;
}

/**
 * macOS-style checkbox with a custom box slightly larger than the native control.
 */
export function Checkbox({ ref, className, ...props }: Props): JSX.Element {
  return (
    <span
      className={cn(
        'hc-checkbox relative inline-flex h-[18px] w-[18px] shrink-0 leading-none',
        className
      )}
    >
      <input
        {...props}
        ref={ref}
        type="checkbox"
        className={cn('hc-checkbox-input', checkboxInput)}
      />
      <span className={cn('hc-checkbox-box', checkboxBox)} aria-hidden>
        <svg
          className="hc-checkbox-icon h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}
