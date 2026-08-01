import { RoundButton } from '@harborclient/sdk/components';
import type { LiveServerLogsPlacement } from '@harborclient/core/types';
import { type JSX } from 'react';
import { faWindowMaximize, faWindowRestore } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Current dock placement of the logs viewer.
   */
  placement: LiveServerLogsPlacement;

  /**
   * Toggles between footer and right-sidebar placement.
   */
  onToggle: () => void;
}

/**
 * Header control that docks live-server logs to the opposite host.
 *
 * Footer placement offers “Show as sidebar”; sidebar placement offers
 * “Show as footer panel”. Placed immediately before the close control.
 *
 * @param props - Current placement and toggle handler.
 * @returns Round icon button naming the destination layout.
 */
export function LiveServerLogsDockButton({ placement, onToggle }: Props): JSX.Element {
  const toSidebar = placement === 'footer';
  const title = toSidebar ? 'Show as sidebar' : 'Show as footer panel';

  return (
    <RoundButton
      icon={toSidebar ? faWindowRestore : faWindowMaximize}
      onClick={onToggle}
      title={title}
      ariaLabel={title}
    />
  );
}
