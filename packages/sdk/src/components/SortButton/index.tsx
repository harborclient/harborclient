import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ComponentPropsWithoutRef, JSX, RefObject } from 'react';
import { Button } from '../Button/index.js';
import { cn } from '../utils.js';
import { SortButtonIcon } from './SortButtonIcon.js';

interface Props extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  /**
   * When true, shows the accent sort-active indicator and full-contrast icon
   * color. When false, the icon uses muted text until hover.
   */
  active?: boolean;

  /**
   * Font Awesome icon to render. Defaults to `faArrowDownShortWide`.
   */
  icon?: IconDefinition;

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
 * Toolbar sort trigger with an optional accent corner indicator when a
 * non-default sort is in effect. Matches the SegmentedTabs indicator color
 * (`bg-accent`) and mirrors {@link FilterButton}.
 *
 * Defaults to `type="button"`. Pass `title` for a native tooltip; when omitted,
 * the tooltip falls back to `aria-label`.
 */
export function SortButton({
  active = false,
  icon,
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
        'hc-sort-button',
        active ? 'text-text hover:text-text' : 'text-muted hover:text-text',
        className
      )}
    >
      <SortButtonIcon active={active} icon={icon} />
    </Button>
  );
}
