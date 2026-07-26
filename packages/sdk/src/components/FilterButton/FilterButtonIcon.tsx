import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import type { JSX } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { StatusDot } from '../StatusDot/index.js';
import { cn } from '../utils.js';

interface Props {
  /**
   * When true, shows a SegmentedTabs-matching accent dot on the icon corner.
   */
  active?: boolean;

  /**
   * Font Awesome icon to render. Defaults to the filter funnel.
   */
  icon?: IconDefinition;

  /**
   * Additional classes merged onto the icon wrapper.
   */
  className?: string;
}

/**
 * Filter funnel icon with an optional accent corner indicator when filters are
 * applied. Shared by {@link FilterButton} and filter-style `RowActionsMenu`
 * triggers so the active affordance stays consistent.
 *
 * @param active - When true, shows the accent status dot.
 * @param icon - Icon to render; defaults to `faFilter`.
 * @param className - Extra classes for the wrapper.
 * @returns Relative icon wrapper with optional active indicator.
 */
export function FilterButtonIcon({
  active = false,
  icon = faFilter,
  className
}: Props): JSX.Element {
  return (
    <span className={cn('hc-filter-button-icon relative inline-flex shrink-0', className)}>
      <FaIcon icon={icon} className="h-3.5 w-3.5" aria-hidden />
      {active ? (
        <StatusDot
          variant="accent"
          size="sm"
          label="Filters applied"
          className="absolute -top-0.5 -right-0.5"
        />
      ) : null}
    </span>
  );
}
