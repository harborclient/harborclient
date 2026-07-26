import type { MenuItem } from '@harborclient/sdk/components';
import { useCallback, useMemo } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { dispatchSidebarMarker } from './sidebarMarkerDispatch';
import type { SidebarMarkerTarget } from './sidebarMarkerTypes';
import { useSidebarMarkerPicker } from './useSidebarMarkerPicker';

interface UseSidebarMarkerMenuItemsOptions {
  /**
   * Entity that will receive the chosen marker.
   */
  target: SidebarMarkerTarget;

  /**
   * Row actions menu id used to locate the trigger for picker anchoring.
   */
  menuId: string;
}

/**
 * Builds Set color marker / Clear color marker menu groups for a sidebar row actions menu.
 *
 * @param options - Target entity and menu id for anchoring.
 */
export function useSidebarMarkerMenuItems({
  target,
  menuId
}: UseSidebarMarkerMenuItemsOptions): MenuItem[][] {
  const dispatch = useAppDispatch();
  const { openMarkerPicker } = useSidebarMarkerPicker();

  /**
   * Returns the row actions trigger rect for anchoring the marker picker.
   */
  const getAnchorRect = useCallback((): DOMRect | null => {
    const element = document.querySelector(`[data-sidebar-actions="${menuId}"]`);
    return element?.getBoundingClientRect() ?? null;
  }, [menuId]);

  /**
   * Menu groups for assigning or clearing the row marker.
   */
  return useMemo(() => {
    const hasColor = target.marker != null && target.marker.trim() !== '';

    return [
      [
        {
          label: 'Set color marker',
          onSelect: () => {
            const rect = getAnchorRect();
            if (rect != null) {
              openMarkerPicker(target, rect);
            }
          }
        },
        ...(hasColor
          ? [
              {
                label: 'Clear color marker',
                onSelect: () => {
                  dispatchSidebarMarker(dispatch, target, null);
                }
              }
            ]
          : [])
      ]
    ];
  }, [dispatch, getAnchorRect, openMarkerPicker, target]);
}
