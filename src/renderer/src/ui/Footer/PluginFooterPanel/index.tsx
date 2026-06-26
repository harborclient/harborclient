import { type ComponentType, type JSX } from 'react';
import { Resizable } from '#/renderer/src/components/Resizable';

interface Props {
  /**
   * Namespaced panel id used for DOM ids and height persistence.
   */
  id: string;

  /**
   * Display title for the close button accessible name.
   */
  title: string;

  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the plugin footer panel.
   */
  onClose: () => void;

  /**
   * Plugin-provided panel content.
   */
  Component: ComponentType;
}

/**
 * Host-owned resizable shell for plugin footer panels.
 *
 * Wraps plugin content with the same resize handle, height persistence, and
 * close affordance as built-in Console and Variables panels.
 */
export function PluginFooterPanel({ id, title, open, onClose, Component }: Props): JSX.Element {
  return (
    <Resizable
      id={`footer-plugin-panel-${id}`}
      open={open}
      onClose={onClose}
      closeLabel={title}
      storageKey={`hc.footerPanel.${id}`}
      headerless
      unmountWhenClosed
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <Component />
      </div>
    </Resizable>
  );
}
