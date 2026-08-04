import { Fragment, type JSX } from 'react';
import { shellPanels } from './panels';
import type { ShellPanelId } from './types';

interface Props {
  /**
   * Ordered panel ids for the main content column (typically the main-column catalog entry).
   */
  panelIds: ShellPanelId[];
}

/**
 * Renders the flex-1 main landmark that hosts the request editor and footer panels.
 */
export function ShellMain({ panelIds }: Props): JSX.Element {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-w-0 flex-1 flex-col bg-surface"
    >
      {panelIds.map((id) => {
        const panel = shellPanels[id];
        if (panel.kind !== 'main') {
          return null;
        }

        return <Fragment key={id}>{panel.render()}</Fragment>;
      })}
    </main>
  );
}
