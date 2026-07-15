import type { MenuItem } from '@harborclient/sdk/components';
import { useCallback, useMemo } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { dispatchSidebarColor } from './sidebarColorDispatch';
import type { SidebarColorTarget } from './sidebarColorTypes';
import { useSidebarColorPicker } from './useSidebarColorPicker';

interface UseSidebarColorMenuItemsOptions {
  /**
   * Entity that will receive the chosen color.
   */
  target: SidebarColorTarget;

  /**
   * Row actions menu id used to locate the trigger for picker anchoring.
   */
  menuId: string;
}

/**
 * Builds Set color / Clear color menu groups for a sidebar row actions menu.
 *
 * @param options - Target entity and menu id for anchoring.
 */
export function useSidebarColorMenuItems({
  target,
  menuId
}: UseSidebarColorMenuItemsOptions): MenuItem[][] {
  const dispatch = useAppDispatch();
  const { openColorPicker } = useSidebarColorPicker();

  /**
   * Returns the row actions trigger rect for anchoring the color picker.
   */
  const getAnchorRect = useCallback((): DOMRect | null => {
    const element = document.querySelector(`[data-sidebar-actions="${menuId}"]`);
    return element?.getBoundingClientRect() ?? null;
  }, [menuId]);

  /**
   * Menu groups for assigning or clearing the row color.
   */
  return useMemo(() => {
    const hasColor = target.color != null && target.color.trim() !== '';

    return [
      [
        {
          label: 'Set color',
          onSelect: () => {
            const rect = getAnchorRect();
            if (rect != null) {
              openColorPicker(target, rect);
            }
          }
        },
        ...(hasColor
          ? [
              {
                label: 'Clear color',
                onSelect: () => {
                  dispatchSidebarColor(dispatch, target, null);
                }
              }
            ]
          : [])
      ]
    ];
  }, [dispatch, getAnchorRect, openColorPicker, target]);
}
