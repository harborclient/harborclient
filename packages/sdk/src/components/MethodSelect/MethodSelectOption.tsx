import type { JSX, Ref } from 'react';
import { methodColorClass } from '../../ui/tokens.js';
import { cn } from '../utils.js';

interface Props {
  /**
   * Visible option label (HTTP method or `SSE`).
   */
  label: string;

  /**
   * Token used for method/protocol badge coloring.
   */
  colorKey: string;

  /**
   * Whether this option is the current selection.
   */
  selected: boolean;

  /**
   * Whether this option currently holds keyboard focus (roving tabindex).
   */
  focused: boolean;

  /**
   * Ref callback so the listbox can focus this option.
   */
  optionRef: Ref<HTMLButtonElement>;

  /**
   * Called when the user activates this option.
   */
  onSelect: () => void;
}

/**
 * Single method or protocol row inside a {@link MethodSelect} listbox.
 *
 * @param props - Label, selection state, and activation handler.
 * @returns Accessible listbox option button.
 */
export function MethodSelectOption({
  label,
  colorKey,
  selected,
  focused,
  optionRef,
  onSelect
}: Props): JSX.Element {
  return (
    <button
      ref={optionRef}
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      className={cn(
        'flex w-full cursor-pointer items-center border-none bg-transparent px-3.5 py-1.5 text-left text-[14px] font-normal hover:bg-selection',
        methodColorClass(colorKey),
        selected ? 'bg-selection/60' : ''
      )}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {label}
    </button>
  );
}
