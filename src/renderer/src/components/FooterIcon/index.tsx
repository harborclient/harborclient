import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';

interface Props {
  /**
   * Font Awesome icon shown inside the footer toggle button.
   */
  icon: IconDefinition;

  /**
   * Whether the associated panel or sidebar is currently open.
   */
  active: boolean;

  /**
   * Called when the user activates the toggle button.
   */
  onClick: () => void;

  /**
   * Noun phrase for accessibility labels, e.g. `"sidebar"` becomes
   * `"Hide sidebar"` / `"Show sidebar"`.
   */
  label: string;

  /**
   * Additional Tailwind classes merged onto the button element.
   */
  className?: string;
}

/**
 * Square icon toggle styles for footer sidebar buttons.
 *
 * @param active - Whether the associated sidebar is currently visible.
 */
function footerIconButton(active: boolean): string {
  return active
    ? 'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-surface text-text shadow-sm app-no-drag'
    : 'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted hover:bg-selection hover:text-text app-no-drag';
}

/**
 * Icon-only toggle button for the window footer bar, used to show or hide
 * sidebars and similar panels.
 */
export function FooterIcon({ icon, active, onClick, label, className }: Props): JSX.Element {
  const accessibleLabel = active ? `Hide ${label}` : `Show ${label}`;
  const classes = className ? `${footerIconButton(active)} ${className}` : footerIconButton(active);

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-pressed={active}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <FaIcon icon={icon} className="h-4 w-4" />
    </button>
  );
}
