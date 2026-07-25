import { faCaretDown } from '@fortawesome/free-solid-svg-icons';
import { useCallback, useEffect, useId, useRef, useState } from '@harborclient/sdk/react';
import type { JSX, KeyboardEvent, ReactNode } from 'react';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { cn, resolveTabListKeyAction } from '../utils.js';
import { MenuCheckboxItem } from './MenuCheckboxItem.js';

/**
 * One entry in a {@link VisibilityMenu} that can be shown or hidden.
 */
export interface VisibilityMenuItem<T extends string> {
  /**
   * Unique item identifier.
   */
  value: T;

  /**
   * Item label or custom content.
   */
  label: ReactNode;
}

interface Props<T extends string> {
  /**
   * Items that can be shown or hidden via the menu.
   */
  items: VisibilityMenuItem<T>[];

  /**
   * Item values currently visible in the parent UI.
   */
  visibleValues: T[];

  /**
   * Called when the user toggles an item's visibility in the menu.
   */
  onToggle: (value: T) => void;
}

const triggerClassName =
  '!rounded-full hover:!bg-[rgba(0,122,255,0.18)] dark:hover:!bg-[rgba(10,132,255,0.22)]';

/**
 * Caret-triggered menu for toggling which items are visible in a parent control.
 */
export function VisibilityMenu<T extends string>({
  items,
  visibleValues,
  onToggle
}: Props<T>): JSX.Element {
  const menuId = useId();
  const menuElementId = `${menuId}-menu`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const wasOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const visibleSet = new Set(visibleValues);

  /**
   * Closes the menu and returns focus to the trigger button.
   */
  const closeMenu = useCallback((): void => {
    setIsOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  /**
   * Opens the menu and focuses the first or last item.
   */
  const openMenu = useCallback(
    (focusLast = false): void => {
      if (items.length === 0) return;
      setFocusedIndex(focusLast ? items.length - 1 : 0);
      setIsOpen(true);
    },
    [items.length]
  );

  /**
   * Focuses a menu item by index and updates roving tabindex state.
   */
  const focusItem = useCallback((index: number): void => {
    setFocusedIndex(index);
    requestAnimationFrame(() => {
      itemRefs.current[index]?.focus();
    });
  }, []);

  /**
   * Moves focus into the menu after it opens and item refs are mounted.
   */
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      requestAnimationFrame(() => {
        itemRefs.current[focusedIndex]?.focus();
      });
    }
    wasOpenRef.current = isOpen;
  }, [focusedIndex, isOpen]);

  /**
   * Resets item refs when the menu closes.
   */
  useEffect(() => {
    if (!isOpen) {
      itemRefs.current = [];
      setFocusedIndex(0);
    }
  }, [isOpen]);

  /**
   * Closes the menu on outside click or Escape while it is open.
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, isOpen]);

  /**
   * Handles keyboard interaction on the menu trigger when closed.
   */
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (isOpen) return;

    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(false);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(true);
    }
  };

  /**
   * Handles keyboard navigation within the open menu.
   */
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (items.length === 0) return;

    if (event.key === 'Tab') {
      closeMenu();
      return;
    }

    const arrowIndex = resolveTabListKeyAction(event.key, focusedIndex, items.length);
    if (arrowIndex !== null) {
      event.preventDefault();
      focusItem(arrowIndex);
    }
  };

  return (
    <div ref={rootRef} className="hc-visibility-menu relative shrink-0">
      <Button
        innerRef={triggerRef}
        type="button"
        variant="icon"
        className={cn('hc-visibility-menu-trigger', triggerClassName)}
        aria-label="Customize visible tabs"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuElementId : undefined}
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            openMenu(false);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <FaIcon icon={faCaretDown} className="h-3.5 w-3.5" />
      </Button>
      {isOpen && (
        <div
          id={menuElementId}
          role="menu"
          className="hc-visibility-menu-panel app-no-drag absolute top-full right-0 z-10 mt-0.5 min-w-[140px] rounded-md border border-separator bg-surface py-1 shadow-md"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => {
            const checked = visibleSet.has(item.value);
            return (
              <MenuCheckboxItem
                key={item.value}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                checked={checked}
                tabIndex={index === focusedIndex ? 0 : -1}
                label={item.label}
                onSelect={() => onToggle(item.value)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
