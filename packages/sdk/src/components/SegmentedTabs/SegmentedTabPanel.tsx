import { useCallback, useContext } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, KeyboardEvent, ReactNode } from 'react';
import { cn } from '../utils.js';
import { SegmentedTabsContext } from './SegmentedTabsContext.js';

interface Props<T extends string> extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Tab value that controls visibility of this panel.
   */
  value: T;

  /**
   * Panel content shown when this tab is selected.
   */
  children: ReactNode;

  /**
   * When true, keeps the panel mounted while inactive so expensive tab content
   * can preserve local state and preload data before it becomes visible.
   */
  keepMounted?: boolean;
}

/**
 * Renders a WAI-ARIA tab panel linked to the matching tab in the parent group.
 */
export function SegmentedTabPanel<T extends string>({
  value,
  children,
  keepMounted = false,
  className,
  ...props
}: Props<T>): JSX.Element | null {
  const context = useContext(SegmentedTabsContext);
  if (!context) {
    throw new Error('SegmentedTabPanel must be used within SegmentedTabsGroup');
  }

  /**
   * Moves focus back to the owning tab when ArrowUp is pressed inside the panel,
   * except inside CodeMirror editors where Up should edit text.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key !== 'ArrowUp' || event.defaultPrevented) return;

      const panel = event.currentTarget;
      if (!panel.contains(document.activeElement)) return;

      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest('.cm-editor')) return;

      const tab = document.getElementById(context.getTabId(value));
      if (tab instanceof HTMLElement) {
        event.preventDefault();
        tab.focus();
      }
    },
    [context, value]
  );

  const selected = context.value === value;
  if (!selected && !keepMounted) return null;

  return (
    <div
      {...props}
      role="tabpanel"
      id={context.getPanelId(value)}
      aria-labelledby={context.getTabId(value)}
      hidden={!selected}
      className={cn('hc-segmented-tab-panel', className)}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
