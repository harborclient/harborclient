import { useEffect, useState } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, RefObject } from 'react';
import { portalToBody } from '../portalToBody.js';
import { cn } from '../utils.js';

interface SuggestionListProps extends Omit<
  ComponentPropsWithoutRef<'ul'>,
  'children' | 'id' | 'role' | 'onSelect'
> {
  /**
   * Whether the suggestion popup should render.
   */
  open: boolean;

  /**
   * Filtered suggestion values.
   */
  items: string[];

  /**
   * Keyboard-highlighted suggestion index.
   */
  activeIndex: number;

  /**
   * Anchor input used to position the popup.
   */
  anchorRef: RefObject<HTMLElement | null>;

  /**
   * Id of the listbox element for aria-controls wiring.
   */
  listboxId: string;

  /**
   * Called when the user selects a suggestion.
   */
  onSelect: (item: string) => void;

  /**
   * Called when the active highlight changes via mouse hover.
   */
  onActiveIndexChange: (index: number) => void;

  /**
   * Called when the popup should close (outside click).
   */
  onClose: () => void;
}

interface PopupPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * Computes fixed popup coordinates from the anchor element.
 */
function getPopupPosition(anchor: HTMLElement | null): PopupPosition | null {
  if (!anchor) {
    return null;
  }

  const rect = anchor.getBoundingClientRect();
  return {
    top: rect.bottom + 2,
    left: rect.left,
    width: rect.width
  };
}

/**
 * Portaled suggestion list for combobox autocomplete inputs.
 */
export function SuggestionList({
  open,
  items,
  activeIndex,
  anchorRef,
  listboxId,
  onSelect,
  onActiveIndexChange,
  onClose,
  className,
  ...props
}: SuggestionListProps): JSX.Element | null {
  const [position, setPosition] = useState<PopupPosition | null>(null);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    /**
     * Updates popup position from the anchor rect.
     */
    const updatePosition = (): void => {
      setPosition(getPopupPosition(anchorRef.current));
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    /**
     * Closes the popup when the user clicks outside the anchor and list.
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const anchor = anchorRef.current;
      const listbox = document.getElementById(listboxId);
      if (anchor?.contains(target) || listbox?.contains(target)) {
        return;
      }

      onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [anchorRef, listboxId, onClose, open]);

  if (!open || items.length === 0 || !position) {
    return null;
  }

  return portalToBody(
    <ul
      {...props}
      id={listboxId}
      role="listbox"
      className={cn(
        'hc-suggestion-list fixed z-50 max-h-48 overflow-y-auto rounded-lg border border-separator bg-surface py-1 text-[14px] text-text shadow-md',
        className
      )}
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      {items.map((item, index) => (
        <li
          key={item}
          id={`${listboxId}-option-${index}`}
          role="option"
          aria-selected={index === activeIndex}
          className={
            index === activeIndex
              ? 'hc-suggestion-list-option cursor-pointer bg-selection px-2 py-1'
              : 'hc-suggestion-list-option cursor-pointer px-2 py-1 hover:bg-selection'
          }
          onMouseEnter={() => onActiveIndexChange(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(item);
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
