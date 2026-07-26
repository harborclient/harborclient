import {
  clampMenuPosition,
  ColorPicker,
  getTriggerAnchoredMenuPosition,
  portalToBody
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useRef, useState, type JSX, type ReactNode } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { dispatchSidebarMarker } from './sidebarMarkerDispatch';
import { SidebarMarkerPickerContext } from './sidebarMarkerPickerContext';
import type { SidebarMarkerTarget } from './sidebarMarkerTypes';

/** Estimated picker dimensions before first layout measurement. */
const PICKER_ESTIMATED_WIDTH_PX = 220;
const PICKER_ESTIMATED_HEIGHT_PX = 180;

interface ProviderProps {
  /**
   * Sidebar subtree that can open the shared marker picker.
   */
  children: ReactNode;
}

/**
 * Provides a single portaled marker picker for all collection sidebar rows.
 */
export function SidebarMarkerPickerProvider({ children }: ProviderProps): JSX.Element {
  const dispatch = useAppDispatch();
  const popoverId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<SidebarMarkerTarget | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  /**
   * Closes the picker and clears anchor state.
   */
  const closePicker = useCallback((): void => {
    setTarget(null);
    setPosition(null);
  }, []);

  /**
   * Opens the picker anchored to the menu trigger that launched Set color marker.
   */
  const openMarkerPicker = useCallback(
    (nextTarget: SidebarMarkerTarget, anchorRect: DOMRect): void => {
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
   * Persists the chosen marker for the active sidebar target.
   *
   * @param marker - Selected CSS marker string.
   */
  const persistMarker = useCallback(
    (marker: string): void => {
      if (target == null) {
        return;
      }
      dispatchSidebarMarker(dispatch, target, marker);
      closePicker();
    },
    [closePicker, dispatch, target]
  );

  /**
   * Clears the marker for the active sidebar target.
   */
  const clearMarker = useCallback((): void => {
    if (target == null) {
      return;
    }
    dispatchSidebarMarker(dispatch, target, null);
    closePicker();
  }, [closePicker, dispatch, target]);

  const contextValue = { openMarkerPicker };

  const pickerPanel =
    target != null && position != null
      ? portalToBody(
          <div
            ref={panelRef}
            id={popoverId}
            role="dialog"
            aria-label="Choose sidebar item color marker"
            className="fixed z-[120] rounded-md border border-separator bg-surface p-3 shadow-lg"
            style={{ left: position.x, top: position.y }}
          >
            <ColorPicker
              value={target.marker}
              onChange={persistMarker}
              onClear={
                target.marker != null && target.marker.trim() !== '' ? clearMarker : undefined
              }
              clearLabel="Clear color marker"
              aria-label="Choose sidebar item color marker"
            />
          </div>
        )
      : null;

  return (
    <SidebarMarkerPickerContext.Provider value={contextValue}>
      {children}
      {pickerPanel}
    </SidebarMarkerPickerContext.Provider>
  );
}

export type { SidebarMarkerTarget } from './sidebarMarkerTypes';
