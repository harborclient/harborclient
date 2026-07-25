import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

/**
 * Visual tone for compact sidebar badges.
 */
export type SidebarBadgeVariant = 'info' | 'recessed';

type BaseProps = {
  /**
   * Badge label content.
   */
  children: ReactNode;

  /**
   * Color and background preset.
   */
  variant?: SidebarBadgeVariant;

  /**
   * Additional Tailwind classes merged onto the badge.
   */
  className?: string;

  /**
   * Tooltip text for the badge.
   */
  title?: string;
};

type SpanProps = BaseProps &
  Omit<ComponentPropsWithoutRef<'span'>, 'children' | 'className' | 'title'> & {
    /**
     * Renders a non-interactive badge. Default for storage location labels.
     */
    as?: 'span';
  };

type ButtonProps = BaseProps &
  Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'className' | 'type' | 'title'> & {
    /**
     * Renders an interactive badge for branch switches and count actions.
     */
    as: 'button';

    /**
     * Button type attribute. Defaults to `button` so badges do not submit forms.
     */
    type?: 'button';
  };

type Props = SpanProps | ButtonProps;

const SIDEBAR_BADGE_OWN_PROPS = new Set([
  'children',
  'variant',
  'className',
  'as',
  'title',
  'type'
]);

/**
 * Returns props safe to spread onto the rendered DOM element.
 *
 * @param props - Full SidebarBadge props including component-only fields.
 * @returns DOM props without SidebarBadge-specific keys.
 */
function sidebarBadgeDomProps(props: Props): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => !SIDEBAR_BADGE_OWN_PROPS.has(key))
  );
}

/**
 * Returns variant and interaction classes for a sidebar badge.
 *
 * @param variant - Color and background preset.
 * @param interactive - Whether the badge is rendered as a button.
 * @returns Tailwind classes for the badge element.
 */
function variantClasses(variant: SidebarBadgeVariant, interactive: boolean): string {
  const base =
    'hc-sidebar-badge inline-flex h-[18px] shrink-0 items-center text-[14px] leading-none';

  if (variant === 'recessed') {
    return cn(
      base,
      'min-w-[22px] justify-center rounded-full bg-selection px-2 font-normal text-muted shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]',
      interactive &&
        'app-no-drag cursor-pointer hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
    );
  }

  return cn(
    base,
    'rounded bg-info/15 px-1.5 font-medium text-info',
    interactive &&
      'app-no-drag cursor-pointer hover:bg-info/25 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
  );
}

/**
 * Compact sidebar badge for storage locations, git branches, and count indicators.
 *
 * Use `variant="info"` for connection or branch labels and `variant="recessed"` for
 * numeric count badges. Pass `as="button"` when the badge triggers an action.
 */
export function SidebarBadge(props: Props): JSX.Element {
  const { children, variant = 'info', className, as = 'span', title } = props;
  const interactive = as === 'button';
  const classes = cn(variantClasses(variant, interactive), className);
  const domProps = sidebarBadgeDomProps(props);

  if (as === 'button') {
    const type = (props as ButtonProps).type ?? 'button';
    return (
      <button type={type} className={classes} title={title} {...domProps}>
        {children}
      </button>
    );
  }

  return (
    <span className={classes} title={title} {...domProps}>
      {children}
    </span>
  );
}
