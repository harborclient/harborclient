import type { JSX } from 'react';
import { stopRowActivation } from './helpers';

interface Props {
  /**
   * Destination URL opened in the system browser.
   */
  href: string;

  /**
   * Visible link text shown in the table cell.
   */
  label: string;

  /**
   * Plugin display name used in the accessible link label.
   */
  pluginName: string;
}

/**
 * External link in a plugin table row that does not activate the row click handler.
 */
export function TableExternalLink({ href, label, pluginName }: Props): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent"
      aria-label={`${label} for ${pluginName}`}
      onClick={stopRowActivation}
      onMouseDown={stopRowActivation}
    >
      {label}
    </a>
  );
}
