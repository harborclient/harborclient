import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { portalToBody } from '../portalToBody.js';
import { cn } from '../utils.js';

export interface Props {
  /**
   * Fixed viewport coordinates for the floating toolbar button.
   */
  coords: { top: number; left: number };

  /**
   * Accessible name announced for the action button.
   */
  label: string;

  /**
   * Visible button label, for example "Copy to chat".
   */
  text: string;

  /**
   * Invoked when the user activates the selection action.
   */
  onSelect: () => void;

  /**
   * Optional leading icon rendered before the visible label.
   */
  icon?: IconDefinition;

  /**
   * Optional muted shortcut hint shown after the label.
   */
  shortcutHint?: string;

  /**
   * Additional classes merged onto the toolbar button.
   */
  className?: string;
}

/**
 * Floating selection action button portaled to document.body so fixed positioning
 * is not clipped by overflow-hidden editor or terminal containers.
 */
export function SelectionActionToolbar({
  coords,
  label,
  text,
  onSelect,
  icon,
  shortcutHint,
  className
}: Props): JSX.Element {
  return portalToBody(
    <button
      type="button"
      className={cn(
        'hc-code-editor-selection-action app-no-drag pointer-events-auto fixed z-[70] inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-separator bg-control px-2 py-1 text-[14px] text-text shadow-sm hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        className
      )}
      style={{ top: coords.top, left: coords.left }}
      aria-label={label}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onSelect}
    >
      {icon ? <FaIcon icon={icon} className="h-3.5 w-3.5" /> : null}
      <span>{text}</span>
      {shortcutHint ? <span className="text-[14px] text-muted">{shortcutHint}</span> : null}
    </button>
  );
}
