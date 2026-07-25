import { faXmark } from '@fortawesome/free-solid-svg-icons';
import React, { type JSX } from 'react';
import { Resizable } from '../Resizable/index.js';
import { RoundButton } from '../RoundButton/index.js';

interface Props {
  id: string;

  /**
   * The title of the panel.
   */
  title?: React.ReactNode;

  /**
   * Displayed next to the title in smaller muted text.
   */
  badge?: React.ReactNode;

  /**
   * Displayed under the title.
   */
  description?: React.ReactNode;

  /**
   * Buttons to display in the footer.
   */
  buttons?: React.ReactNode[];

  /**
   * The label for the close button.
   */
  closeLabel: string;

  /**
   * The memory storage key.
   */
  storageKey: string;

  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the variables panel.
   */
  onClose: () => void;

  /**
   * The contents of the panel.
   */
  children: React.ReactNode;

  /**
   * When true, does not render children while the panel is closed.
   */
  unmountWhenClosed?: boolean;
}

/**
 * Resizable panel that slides up from the footer.
 */
export function FooterPanel({
  id,
  title,
  badge,
  description,
  closeLabel,
  storageKey,
  buttons,
  open,
  onClose,
  children,
  unmountWhenClosed = false
}: Props): JSX.Element {
  const closeButton = (
    <RoundButton
      icon={faXmark}
      title="Close"
      ariaLabel={`Close ${closeLabel}`}
      onClick={onClose}
      className="hc-footer-panel-close"
    />
  );

  return (
    <Resizable
      id={id}
      open={open}
      onClose={onClose}
      closeLabel={closeLabel}
      storageKey={storageKey}
      unmountWhenClosed={unmountWhenClosed}
      showCloseButton={false}
      headerless
    >
      <div className="hc-footer-panel flex shrink-0 items-center justify-between border-b border-separator px-3 py-2">
        <div>
          <div className="flex items-center gap-2 font-medium text-text">
            {title}
            {badge && <span className="hc-footer-panel-badge font-normal text-muted">{badge}</span>}
          </div>
          {description && <span className="truncate text-muted">{description}</span>}
        </div>

        <div className="flex gap-2">
          {buttons}
          {closeButton}
        </div>
      </div>
      <div className="hc-footer-panel-body min-h-0 flex-1 overflow-auto">{children}</div>
    </Resizable>
  );
}
