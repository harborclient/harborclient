import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { footerIconButtonSizeClass } from '../footerBarUtils.js';
import { cn } from '../utils.js';

/**
 * Active-state background treatment for footer icon toggles.
 */
type ActiveStyle = 'surface' | 'selection';

interface Props extends Omit<ComponentPropsWithoutRef<'button'>, 'aria-label' | 'aria-pressed'> {
  /**
   * Font Awesome icon shown inside the footer toggle button.
   */
  icon: IconDefinition;

  /**
   * Whether the associated panel or sidebar is currently open.
   */
  active: boolean;

  /**
   * Noun phrase for accessibility labels, e.g. `"sidebar"` becomes
   * `"Hide sidebar"` / `"Show sidebar"`.
   */
  label: string;

  /**
   * Optional tooltip text. Defaults to the computed show/hide label.
   */
  title?: string;

  /**
   * Active-state background treatment. Use `"selection"` to match sidebar
   * toolbar icon toggles (`bg-sidebar-section`); defaults to `"surface"` for
   * the action menu icon. Active icons use `text-footer-icon-active`.
   */
  activeStyle?: ActiveStyle;
}

const footerIconBase = `inline-flex ${footerIconButtonSizeClass} shrink-0 cursor-pointer items-center justify-center rounded-md border-none app-no-drag`;

/**
 * Square icon toggle styles for footer sidebar buttons.
 *
 * @param active - Whether the associated panel or sidebar is open.
 * @param activeStyle - Active background treatment for the toggle.
 * @returns Tailwind class string for the footer icon button.
 */
function footerIconButton(active: boolean, activeStyle: ActiveStyle): string {
  if (activeStyle === 'selection') {
    return active
      ? `${footerIconBase} bg-sidebar-section text-footer-icon-active`
      : `${footerIconBase} bg-transparent text-footer-text hover:bg-selection focus-visible:bg-selection focus-visible:text-footer-text`;
  }

  return active
    ? `${footerIconBase} bg-surface text-footer-icon-active shadow-sm`
    : `${footerIconBase} bg-transparent text-footer-muted hover:bg-selection hover:text-footer-text`;
}

/**
 * Icon-only toggle button for the window footer bar, used to show or hide
 * sidebars and similar panels.
 */
export function FooterIcon({
  icon,
  active,
  onClick,
  label,
  title,
  activeStyle = 'surface',
  className,
  ...props
}: Props): JSX.Element {
  const accessibleLabel = active ? `Hide ${label}` : `Show ${label}`;
  return (
    <button
      {...props}
      type="button"
      className={cn('hc-footer-icon', footerIconButton(active, activeStyle), className)}
      onClick={onClick}
      aria-pressed={active}
      aria-label={accessibleLabel}
      title={title ?? accessibleLabel}
    >
      <FaIcon
        icon={icon}
        className={cn(
          'hc-footer-icon-icon h-4 w-4',
          activeStyle === 'selection' && (active ? 'opacity-100' : 'opacity-50')
        )}
      />
    </button>
  );
}
