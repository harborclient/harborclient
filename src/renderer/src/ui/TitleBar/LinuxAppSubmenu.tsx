import { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import type { AppSubmenuItemSnapshot, RootMenuLabel } from '#/shared/types';

interface Position {
  /** Viewport X coordinate where the menu opens. */
  x: number;
  /** Viewport Y coordinate where the menu opens. */
  y: number;
}

interface Props {
  /** Root menu label shown in the menu bar. */
  label: RootMenuLabel;
  /** Snapshot entries returned from the main process. */
  items: AppSubmenuItemSnapshot[];
  /** Anchor position below the menu bar button. */
  position: Position;
  /** Called when the submenu should close. */
  onClose: () => void;
}

/**
 * Clamps a submenu position so the panel stays fully inside the viewport.
 *
 * @param position - Requested top-left coordinates.
 * @param size - Measured submenu width and height.
 */
function clampMenuPosition(position: Position, size: { width: number; height: number }): Position {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - size.width - margin);
  const maxY = Math.max(margin, window.innerHeight - size.height - margin);
  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY)
  };
}

/**
 * Themed application submenu for Linux frameless windows.
 *
 * Uses renderer CSS tokens instead of native GTK popups so dropdown appearance
 * matches the active HarborClient theme.
 */
export function LinuxAppSubmenu({ label, items, position, onClose }: Props): JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const [clampedPosition, setClampedPosition] = useState(position);

  /**
   * Closes the submenu and notifies the parent.
   */
  const closeMenu = useCallback((): void => {
    onClose();
  }, [onClose]);

  /**
   * Activates a submenu item through the main-process application menu.
   *
   * @param index - Flat submenu index from the snapshot.
   */
  const activateItem = useCallback(
    (index: number): void => {
      closeMenu();
      void window.api.activateAppSubmenuItem(label, index);
    },
    [closeMenu, label]
  );

  /**
   * Re-clamps the submenu after mount once dimensions are known.
   */
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const rect = menu.getBoundingClientRect();
    setClampedPosition(
      clampMenuPosition(position, {
        width: rect.width,
        height: rect.height
      })
    );
  }, [items, position]);

  /**
   * Closes the submenu on outside click or Escape while it is open.
   */
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu]);

  if (items.length === 0) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      className="fixed z-50 min-w-[240px] rounded-md border border-separator bg-surface py-1 shadow-md app-no-drag"
      style={{ left: clampedPosition.x, top: clampedPosition.y }}
    >
      {items.map((item) => {
        if (item.kind === 'separator') {
          return (
            <div
              key={`sep-${item.index}`}
              role="separator"
              className="my-1 border-t border-separator"
            />
          );
        }

        const itemClass = item.enabled
          ? 'flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-[16px] text-text hover:bg-selection app-no-drag'
          : 'flex w-full cursor-default items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-[16px] text-text-secondary opacity-60 app-no-drag';

        return (
          <button
            key={`item-${item.index}`}
            type="button"
            role="menuitem"
            disabled={!item.enabled}
            aria-checked={item.kind === 'checkbox' ? item.checked === true : undefined}
            className={itemClass}
            onClick={() => {
              if (!item.enabled) {
                return;
              }
              activateItem(item.index);
            }}
          >
            <span className="w-4 shrink-0 text-center" aria-hidden="true">
              {item.kind === 'checkbox' && item.checked ? '✓' : ''}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.accelerator ? (
              <span className="shrink-0 pl-4 text-[16px] text-text-secondary">
                {item.accelerator}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
