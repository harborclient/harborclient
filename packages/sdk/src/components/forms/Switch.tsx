import type { ComponentPropsWithoutRef, JSX, Ref } from 'react';
import { cn } from '../utils.js';
import { switchInput, switchThumb, switchTrack } from './classes.js';

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
 * On/off toggle for binary settings where the change applies immediately.
 *
 * Built on a native checkbox with `role="switch"` so keyboard activation, form
 * participation, and screen-reader state come for free; the visible pill and
 * knob are decorative siblings driven by `peer-checked`.
 */
export function Switch({ ref, className, ...props }: Props): JSX.Element {
  return (
    <span
      className={cn(
        'hc-switch relative inline-flex h-[26px] w-[44px] shrink-0 leading-none',
        className
      )}
    >
      <input
        {...props}
        ref={ref}
        type="checkbox"
        role="switch"
        className={cn('hc-switch-input', switchInput)}
      />
      <span className={cn('hc-switch-track', switchTrack)} aria-hidden>
        <span className={cn('hc-switch-thumb', switchThumb)} />
      </span>
    </span>
  );
}
