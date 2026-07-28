import type { JSX, MouseEvent, MouseEventHandler } from 'react';
import { SegmentShell } from '../Breadcrumb/SegmentShell.js';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { portalToBody } from '../portalToBody.js';
import { cn } from '../utils.js';
import { COPY_TO_CHAT_ICON, COPY_TO_CHAT_LABEL, COPY_TO_CHAT_SHORTCUT_HINT } from './constants.js';

export {
  COPY_TO_CHAT_ICON,
  COPY_TO_CHAT_LABEL,
  COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY,
  COPY_TO_CHAT_SHORTCUT_HINT,
  COPY_TO_CHAT_SHORTCUT_LETTER,
  copyToChatActionLabel
} from './constants.js';

/** Shared chrome for the labeled breadcrumb-style Copy to chat control. */
const LABELED_BUTTON_CLASS =
  'hc-copy-to-chat-button hc-code-editor-selection-action app-no-drag inline-flex cursor-pointer items-stretch overflow-hidden rounded-lg border-none bg-breadcrumb-background p-0 text-[14px] text-text shadow-sm hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

export interface Props {
  /**
   * Invoked when the user activates the Copy to chat control.
   */
  onSelect: () => void;

  /**
   * Accessible name announced for the action button.
   */
  'aria-label': string;

  /**
   * Visual presentation of the control.
   *
   * - `labeled` — breadcrumb-style icon cap plus label and shortcut hint (default).
   * - `icon` — icon-only button matching shared icon controls.
   */
  appearance?: 'labeled' | 'icon';

  /**
   * When set, portals a fixed-position floating button at these viewport coordinates
   * so overflow-hidden editor or terminal containers cannot clip it.
   */
  coords?: { top: number; left: number };

  /**
   * Additional classes merged onto the button (layout tweaks only).
   */
  className?: string;

  /**
   * Optional native click handler for hosts that need stopPropagation.
   * Defaults to calling {@link onSelect} only.
   */
  onClick?: MouseEventHandler<HTMLButtonElement>;

  /**
   * Optional native title attribute (icon appearance often pairs this with aria-label).
   */
  title?: string;
}

/**
 * Shared Copy to chat control used for selection toolbars, floating overlays, and
 * icon-only row/header actions so label, icon, shortcut, and styles stay in one place.
 *
 * The labeled appearance uses interlocking breadcrumb segments: a blue wand icon
 * cap on the left and a dark label/shortcut segment on the right.
 */
export function CopyToChatButton({
  onSelect,
  'aria-label': ariaLabel,
  appearance = 'labeled',
  coords,
  className,
  onClick,
  title
}: Props): JSX.Element {
  /**
   * Runs optional host click side effects (for example stopPropagation), then
   * invokes {@link onSelect}.
   *
   * @param event - Native click from the button.
   */
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event);
    onSelect();
  };

  if (appearance === 'icon') {
    const iconButton = (
      <Button
        type="button"
        variant="icon"
        aria-label={ariaLabel}
        title={title}
        className={cn('hc-copy-to-chat-button', className)}
        onClick={handleClick}
      >
        <FaIcon icon={COPY_TO_CHAT_ICON} className="h-3.5 w-3.5" aria-hidden />
      </Button>
    );

    if (coords == null) {
      return iconButton;
    }

    return portalToBody(
      <div
        className="pointer-events-auto fixed z-[70]"
        style={{ top: coords.top, left: coords.left }}
      >
        {iconButton}
      </div>
    );
  }

  const labeledButton = (
    <button
      type="button"
      className={cn(
        LABELED_BUTTON_CLASS,
        coords != null && 'pointer-events-auto fixed z-[70]',
        className
      )}
      style={coords != null ? { top: coords.top, left: coords.left } : undefined}
      aria-label={ariaLabel}
      title={title}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={handleClick}
    >
      <SegmentShell shape="first" tone="selection" density="compact" className="shrink-0">
        <FaIcon icon={COPY_TO_CHAT_ICON} className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </SegmentShell>
      <SegmentShell shape="last" tone="current" density="compact" className="shrink-0">
        <span>{COPY_TO_CHAT_LABEL}</span>
        <span className="text-[14px] text-muted">{COPY_TO_CHAT_SHORTCUT_HINT}</span>
      </SegmentShell>
    </button>
  );

  if (coords == null) {
    return labeledButton;
  }

  return portalToBody(labeledButton);
}
