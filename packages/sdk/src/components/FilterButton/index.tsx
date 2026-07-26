import type { ComponentPropsWithoutRef, JSX, RefObject } from 'react';
import { Button } from '../Button/index.js';
import { cn } from '../utils.js';
import { FilterButtonIcon } from './FilterButtonIcon.js';

interface Props extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  /**
   * When true, shows the accent filter-active indicator and full-contrast icon
   * color. When false, the icon uses muted text until hover.
   */
  active?: boolean;

  /**
   * Accessible name for the icon-only control.
   */
  'aria-label': string;

  /**
   * Ref forwarded to the underlying native button for popover anchoring.
   */
  innerRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Toolbar filter trigger with an optional accent corner indicator when filters
 * are in effect. Matches the SegmentedTabs indicator color (`bg-accent`).
 *
 * Defaults to `type="button"`. Pass `title` for a native tooltip; when omitted,
 * the tooltip falls back to `aria-label`.
 */
export function FilterButton({
  active = false,
  className,
  title,
  innerRef,
  type = 'button',
  'aria-label': ariaLabel,
  ...props
}: Props): JSX.Element {
  return (
    <Button
      {...props}
      type={type}
      variant="toolbar"
      innerRef={innerRef}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      className={cn(
        'hc-filter-button',
        active ? 'text-text hover:text-text' : 'text-muted hover:text-text',
        className
      )}
    >
      <FilterButtonIcon active={active} />
    </Button>
  );
}
