import { SidebarRequestItem } from '@harborclient/sdk/components';
import type { JSX, ReactNode } from 'react';

interface Props {
  /**
   * HTTP method for the leading badge.
   */
  method: string;

  /**
   * Request display name.
   */
  name: string;

  /**
   * Optional trailing actions (e.g. status/time/size metrics).
   * Omitted automatically when {@link compact} is true.
   */
  actions?: ReactNode;

  /**
   * When true, hides trailing actions so narrow timeline blocks stay readable.
   */
  compact?: boolean;
}

/**
 * Shared send-step presentation used by timeline and Results registry thumbnails.
 *
 * Matches Results send rows: sidebar method badge + request name, with optional
 * status metrics passed as {@link actions}.
 *
 * @param props - Method, name, optional actions, and compact density flag.
 * @returns Sidebar-styled request row content for a workflow send block.
 */
export function WorkflowSendActionContent({
  method,
  name,
  actions,
  compact = false
}: Props): JSX.Element {
  return (
    <SidebarRequestItem
      as="div"
      method={method}
      name={name}
      className="pl-0 hover:bg-transparent [&_.hc-method-badge]:pl-0"
      actions={compact ? undefined : actions}
    />
  );
}
