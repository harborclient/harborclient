import {
  clampMenuPosition,
  ColorPicker,
  getTriggerAnchoredMenuPosition,
  portalToBody
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useRef, useState, type JSX, type ReactNode } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { dispatchSidebarColor } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarColorDispatch';
import { SidebarColorPickerContext } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarColorPickerContext';
import type { SidebarColorTarget } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarColorTypes';

/** Estimated picker dimensions before first layout measurement. */
const PICKER_ESTIMATED_WIDTH_PX = 220;
const PICKER_ESTIMATED_HEIGHT_PX = 180;

interface ProviderProps {
  /**
   * Sidebar subtree that can open the shared color picker.
   */
  children: ReactNode;
}

/**
 * Provides a single portaled color picker for all collection sidebar rows.
 */
export function SidebarColorPickerProvider({ children }: ProviderProps): JSX.Element {
  const dispatch = useAppDispatch();
  const popoverId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<SidebarColorTarget | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  /**
   * Closes the picker and clears anchor state.
   */
  const closePicker = useCallback((): void => {
    setTarget(null);
    setPosition(null);
  }, []);

  /**
   * Opens the picker anchored to the menu trigger that launched Set color.
   */
  const openColorPicker = useCallback(
    (nextTarget: SidebarColorTarget, anchorRect: DOMRect): void => {
      const anchored = getTriggerAnchoredMenuPosition(
        anchorRect,
        { width: PICKER_ESTIMATED_WIDTH_PX, height: PICKER_ESTIMATED_HEIGHT_PX },
        'down'
      );
      setTarget(nextTarget);
      setPosition(
        clampMenuPosition(anchored, {
          width: PICKER_ESTIMATED_WIDTH_PX,
          height: PICKER_ESTIMATED_HEIGHT_PX
        })
      );
    },
    []
  );

  /**
   * Closes the picker on outside pointer down or Escape.
   */
  useEffect(() => {
    if (target == null) {
      return;
    }

    /**
     * Closes the picker when the user clicks outside the panel.
     *
     * @param event - Document pointer event.
     */
    const handlePointerDown = (event: MouseEvent): void => {
      if (!panelRef.current?.contains(event.target as Node)) {
        closePicker();
      }
    };

    /**
     * Closes the picker when the user presses Escape.
     *
     * @param event - Document keyboard event.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closePicker();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePicker, target]);

  /**
   * Persists the chosen color for the active sidebar target.
   *
   * @param color - Selected CSS color string.
   */
  const persistColor = useCallback(
    (color: string): void => {
      if (target == null) {
        return;
      }
      dispatchSidebarColor(dispatch, target, color);
      closePicker();
    },
    [closePicker, dispatch, target]
  );

  /**
   * Clears the color for the active sidebar target.
   */
  const clearColor = useCallback((): void => {
    if (target == null) {
      return;
    }
    dispatchSidebarColor(dispatch, target, null);
    closePicker();
  }, [closePicker, dispatch, target]);

  const contextValue = { openColorPicker };

  const pickerPanel =
    target != null && position != null
      ? portalToBody(
          <div
            ref={panelRef}
            id={popoverId}
            role="dialog"
            aria-label="Choose sidebar item color"
            className="fixed z-[120] rounded-md border border-separator bg-surface p-3 shadow-lg"
            style={{ left: position.x, top: position.y }}
          >
            <ColorPicker
              value={target.color}
              onChange={persistColor}
              onClear={target.color != null && target.color.trim() !== '' ? clearColor : undefined}
              aria-label="Choose sidebar item color"
            />
          </div>
        )
      : null;

  return (
    <SidebarColorPickerContext.Provider value={contextValue}>
      {children}
      {pickerPanel}
    </SidebarColorPickerContext.Provider>
  );
}

export type { SidebarColorTarget } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarColorTypes';
