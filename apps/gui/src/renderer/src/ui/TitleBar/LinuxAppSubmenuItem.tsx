import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent
} from 'react';
import type { AppSubmenuItemSnapshot } from '@harborclient/core/types';
import { LinuxAppSubmenuLeaf } from './LinuxAppSubmenuLeaf';

interface Props {
  /** Top-level snapshot entry to render. */
  item: AppSubmenuItemSnapshot;
  /**
   * Activates an item through the main-process application menu.
   *
   * @param index - Top-level index of the item within the root submenu.
   * @param nestedIndex - Child index when activating a nested submenu entry.
   */
  onActivate: (index: number, nestedIndex?: number) => void;
}

/**
 * Renders one top-level Linux application submenu entry.
 *
 * Leaf entries render directly; entries with a nested submenu (such as
 * View > Theme) render a parent row that opens a flyout of child rows on hover,
 * click, or keyboard, positioned to stay within the viewport.
 *
 * @param props - Item snapshot and activation handler.
 * @returns The rendered entry.
 */
export function LinuxAppSubmenuItem({ item, onActivate }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [openLeft, setOpenLeft] = useState(false);
  const parentRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  /**
   * Closes the nested flyout and returns focus to its parent row.
   */
  const closeFlyout = useCallback((): void => {
    setOpen(false);
    parentRef.current?.focus();
  }, []);

  /**
   * Flips the flyout to the left when it would overflow the viewport's right
   * edge, re-measured whenever the flyout opens.
   */
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const parent = parentRef.current;
    const flyout = flyoutRef.current;
    if (!parent || !flyout) {
      return;
    }
    const parentRect = parent.getBoundingClientRect();
    const flyoutWidth = flyout.getBoundingClientRect().width;
    setOpenLeft(parentRect.right + flyoutWidth > window.innerWidth - 8);
  }, [open]);

  if (item.kind !== 'submenu') {
    return <LinuxAppSubmenuLeaf item={item} onActivate={() => onActivate(item.index)} />;
  }

  /**
   * Opens the flyout on ArrowRight/Enter/Space and closes it on ArrowLeft/Escape.
   *
   * @param event - Keyboard event from the parent row or flyout.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        closeFlyout();
      }
      return;
    }
    if (!open && (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const parentClass = item.enabled
    ? 'flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-text hover:bg-selection app-no-drag'
    : 'flex w-full cursor-default items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-text-secondary opacity-60 app-no-drag';

  return (
    <div
      className="relative"
      onMouseEnter={() => item.enabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={parentRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!item.enabled}
        className={parentClass}
        onClick={() => item.enabled && setOpen((value) => !value)}
      >
        <span className="w-4 shrink-0 text-center" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="shrink-0 pl-4 text-text-secondary" aria-hidden="true">
          ›
        </span>
      </button>
      {open ? (
        <div
          ref={flyoutRef}
          role="menu"
          aria-label={item.label}
          className={`absolute top-0 z-50 min-w-[200px] rounded-md border border-separator bg-surface py-1 shadow-md app-no-drag ${
            openLeft ? 'right-full mr-1' : 'left-full ml-1'
          }`}
        >
          {item.submenu.map((child) => (
            <LinuxAppSubmenuLeaf
              key={`${child.kind}-${child.index}`}
              item={child as Exclude<AppSubmenuItemSnapshot, { kind: 'submenu' }>}
              onActivate={() => onActivate(item.index, child.index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
