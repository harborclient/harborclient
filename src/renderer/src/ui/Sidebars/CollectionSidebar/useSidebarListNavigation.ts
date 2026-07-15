import { useEffect, useState } from 'react';
import { acceleratorMatchesChord, getShortcutDef, type KeyChord } from '#/shared/shortcuts';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { advanceSidebarListItem } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarListNavigation';

interface SidebarListAccelerators {
  /** Effective accelerator for next sidebar list item. */
  next: string;
  /** Effective accelerator for previous sidebar list item. */
  previous: string;
}

/**
 * Resolves default accelerators for sidebar list navigation shortcuts.
 *
 * @returns Default next/previous accelerator strings from the registry.
 */
function defaultSidebarListAccelerators(): SidebarListAccelerators {
  return {
    next: getShortcutDef('next-sidebar-list-item')?.defaultAccelerator ?? 'CmdOrCtrl+Tab',
    previous:
      getShortcutDef('previous-sidebar-list-item')?.defaultAccelerator ?? 'CmdOrCtrl+Shift+Tab'
  };
}

/**
 * Builds a key chord from a DOM keyboard event for shortcut comparison.
 *
 * @param event - Keydown event from the sidebar navigation listener.
 * @returns Normalized chord for {@link acceleratorMatchesChord}.
 */
function chordFromKeyboardEvent(event: KeyboardEvent): KeyChord {
  return {
    key: event.key,
    control: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey
  };
}

/**
 * Wires Ctrl+Tab / Ctrl+Shift+Tab (configurable) to move among collection or
 * environment rows when the matching sidebar section has focus.
 *
 * @param selectedCollectionId - Selected collection id from the store.
 * @param activeEnvironmentId - Active environment id from the store.
 */
export function useSidebarListNavigation(
  selectedCollectionId: number | null,
  activeEnvironmentId: number | null
): void {
  const dispatch = useAppDispatch();
  const [accelerators, setAccelerators] = useState<SidebarListAccelerators>(
    defaultSidebarListAccelerators
  );

  /**
   * Loads effective sidebar list navigation bindings from shortcut settings.
   */
  useEffect(() => {
    let cancelled = false;
    void window.api.getShortcuts().then((bindings) => {
      if (cancelled) {
        return;
      }

      const defaults = defaultSidebarListAccelerators();
      setAccelerators({
        next:
          bindings.find((binding) => binding.id === 'next-sidebar-list-item')?.accelerator ??
          defaults.next,
        previous:
          bindings.find((binding) => binding.id === 'previous-sidebar-list-item')?.accelerator ??
          defaults.previous
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Handles next/previous sidebar list navigation when focus is in a list section.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const chord = chordFromKeyboardEvent(event);
      let direction: 1 | -1 | null = null;

      if (acceleratorMatchesChord(accelerators.next, chord)) {
        direction = 1;
      } else if (acceleratorMatchesChord(accelerators.previous, chord)) {
        direction = -1;
      } else {
        return;
      }

      const handled = advanceSidebarListItem({
        direction,
        dispatch,
        selectedCollectionId,
        activeEnvironmentId
      });

      if (!handled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [accelerators, dispatch, selectedCollectionId, activeEnvironmentId]);
}
