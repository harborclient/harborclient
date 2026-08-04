import { type JSX } from 'react';
import { shellPanels } from './panels';
import { ShellAnimatedPanel } from './ShellAnimatedPanel';
import type { ShellPanelId, ShellZone } from './types';

interface Props {
  /**
   * Zone name (used for documentation / debugging; order comes from panelIds).
   */
  zone: ShellZone;

  /**
   * Ordered panel ids to mount as animated horizontal panels in this zone.
   */
  panelIds: ShellPanelId[];
}

/**
 * Renders a stack of animated sidebar panels for one shell zone.
 *
 * Non-`animatedHorizontal` catalog entries in the id list are skipped so a
 * misplaced main-column id cannot break the sidebar stack.
 */
export function ShellZoneStack({ zone, panelIds }: Props): JSX.Element {
  return (
    <>
      {panelIds.map((id) => {
        const panel = shellPanels[id];
        if (panel.kind !== 'animatedHorizontal') {
          return null;
        }

        return <ShellAnimatedPanel key={`${zone}:${id}`} panel={panel} />;
      })}
    </>
  );
}
