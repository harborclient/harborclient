import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

interface Props extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'children' | 'aria-expanded' | 'aria-controls'
> {
  /**
   * Whether the associated slide-up panel is currently open.
   */
  active?: boolean;

  /**
   * Panel element id referenced by `aria-controls`.
   */
  controlsId?: string;

  /**
   * Button label and optional count badge content.
   */
  children: ReactNode;
}

/**
 * Compact segment button styles for the footer bar.
 */
function footerSegment(active: boolean): string {
  return active
    ? 'cursor-pointer rounded-md border-none bg-surface px-2 py-0.5 text-[14px] text-footer-text shadow-sm app-no-drag'
    : 'cursor-pointer rounded-md border-none bg-transparent px-2 py-0.5 text-[14px] text-footer-muted hover:text-footer-text app-no-drag';
}

/**
 * Text segment toggle button for the window footer bar, used to open and close
 * slide-up panels such as Console and Variables.
 */
export function FooterButton({
  active = false,
  onClick,
  controlsId,
  children,
  className,
  ...props
}: Props): JSX.Element {
  return (
    <button
      {...props}
      type="button"
      className={cn('hc-footer-button', footerSegment(active), className)}
      onClick={onClick}
      aria-expanded={active}
      aria-controls={controlsId}
    >
      {children}
    </button>
  );
}
