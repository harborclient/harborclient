import { type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { AnimatedHorizontalPanel } from '#/renderer/src/ui/Shared/Animated/AnimatedHorizontalPanel';
import type { ShellPanelDescriptor } from './types';

interface Props {
  /**
   * Catalog entry describing open state, mount policy, and body render.
   */
  panel: ShellPanelDescriptor;
}

/**
 * Mounts an animated horizontal shell panel from a catalog descriptor.
 *
 * Honors `mountWhenClosed: false` so heavy sidebars (live-server logs) stay
 * unmounted while closed.
 */
export function ShellAnimatedPanel({ panel }: Props): JSX.Element {
  const open = useAppSelector(panel.selectOpen);
  const mountWhenClosed = panel.mountWhenClosed !== false;
  const children = !open && !mountWhenClosed ? null : panel.render();

  return (
    <AnimatedHorizontalPanel id={panel.id} tabIndex={-1} open={open}>
      {children}
    </AnimatedHorizontalPanel>
  );
}
