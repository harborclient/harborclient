import type { MenuItem } from '@harborclient/sdk/components';
import { useEffect, useState } from 'react';

/**
 * Viewport coordinates used to target an element for DevTools inspection.
 */
export interface InspectPoint {
  /**
   * Horizontal coordinate relative to the viewport.
   */
  x: number;

  /**
   * Vertical coordinate relative to the viewport.
   */
  y: number;
}

/**
 * Returns whether developer tooling is available for this application session.
 *
 * @returns True when DevTools and Inspect Element should be exposed in menus.
 */
export function useDeveloperToolsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  /**
   * Loads the stable developer-tools flag from the main process once on mount.
   */
  useEffect(() => {
    void window.api.isDeveloperToolsEnabled().then(setEnabled);
  }, []);

  return enabled;
}

/**
 * Resolves viewport coordinates for Inspect Element.
 *
 * Prefers the right-click position when available; otherwise centers on the row
 * actions trigger so hamburger-opened menus still inspect a sensible target.
 *
 * @param point - Right-click coordinates captured for this menu, if any.
 * @param menuId - Row actions menu id used to locate the trigger button.
 * @returns Viewport coordinates for `window.api.inspectElement`.
 */
export function resolveInspectPoint(point: InspectPoint | undefined, menuId: string): InspectPoint {
  if (point != null) {
    return point;
  }

  const trigger =
    document.querySelector(`.hc-row-actions-menu-trigger[aria-controls="${menuId}-menu"]`) ??
    document.querySelector(`[aria-controls="${menuId}-menu"]`);
  if (
    trigger != null &&
    'getBoundingClientRect' in trigger &&
    typeof trigger.getBoundingClientRect === 'function'
  ) {
    const rect = trigger.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };
}

/**
 * Builds the developer-tools Inspect Element group for row action menus.
 *
 * @param point - Right-click coordinates captured for this menu, if any.
 * @param menuId - Row actions menu id used to resolve a fallback inspect target.
 * @param enabled - Whether developer tooling is available in this session.
 * @returns A single-group menu fragment, or an empty array when disabled.
 */
export function buildDevInspectMenuGroups(
  point: InspectPoint | undefined,
  menuId: string,
  enabled: boolean
): MenuItem[][] {
  if (!enabled) {
    return [];
  }

  return [
    [
      {
        label: 'Inspect Element',
        onSelect: () => {
          const resolved = resolveInspectPoint(point, menuId);
          void window.api.inspectElement(resolved.x, resolved.y);
        }
      }
    ]
  ];
}
