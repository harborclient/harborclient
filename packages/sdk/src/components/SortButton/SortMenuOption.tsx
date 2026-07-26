import { faCheck } from '@fortawesome/free-solid-svg-icons';
import type { JSX, Ref } from 'react';
import { FaIcon } from '../FaIcon/index.js';

interface Props {
  /**
   * Visible option label.
   */
  label: string;

  /**
   * Whether this option is the current sort selection.
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
 * Single checkable row inside a {@link SortMenu} listbox.
 *
 * @param label - Visible option text.
 * @param selected - Whether this option is the active sort mode.
 * @param focused - Whether this option has the roving tabindex.
 * @param optionRef - Ref callback for focus management.
 * @param onSelect - Called when the option is activated.
 */
export function SortMenuOption({
  label,
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
      className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-[14px] text-text hover:bg-selection app-no-drag"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span className="inline-flex w-4 shrink-0 justify-center" aria-hidden>
        {selected ? <FaIcon icon={faCheck} className="h-3 w-3" /> : null}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
