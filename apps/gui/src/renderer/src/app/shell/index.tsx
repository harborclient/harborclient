import { type JSX } from 'react';
import { ShellMain } from './ShellMain';
import { ShellZoneStack } from './ShellZoneStack';
import type { ShellLayoutConfig } from './types';

interface Props {
  /**
   * Zone → panel id placement for the middle band of the app window.
   */
  layout: ShellLayoutConfig;
}

/**
 * Zone-based middle band of the app: primary sidebars, main column, secondary sidebars.
 *
 * Placement is data ({@link ShellLayoutConfig}); chrome such as TitleBar and Footer
 * stay in `App`. Providers and bootstrap effects also remain outside this component.
 */
export function AppShell({ layout }: Props): JSX.Element {
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <ShellZoneStack zone="primarySidebar" panelIds={layout.primarySidebar} />
      <ShellMain panelIds={layout.main} />
      <ShellZoneStack zone="secondarySidebar" panelIds={layout.secondarySidebar} />
    </div>
  );
}
