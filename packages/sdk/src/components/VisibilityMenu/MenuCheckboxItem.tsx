import { faCheck } from '@fortawesome/free-solid-svg-icons';
import type { JSX, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

const menuItemClass =
  'flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-[14px] text-text hover:bg-selection app-no-drag';

interface Props {
  checked: boolean;
  label: ReactNode;
  tabIndex: number;
  onSelect: () => void;
  ref?: (element: HTMLButtonElement | null) => void;
}

/**
 * Single checkbox-style row in the visibility menu.
 */
export function MenuCheckboxItem({ checked, label, tabIndex, onSelect, ref }: Props): JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={tabIndex}
      className={cn('hc-visibility-menu-item', menuItemClass)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span
        className="hc-visibility-menu-item-check inline-flex w-4 shrink-0 justify-center"
        aria-hidden
      >
        {checked ? <FaIcon icon={faCheck} className="h-3 w-3" /> : null}
      </span>
      <span className="hc-visibility-menu-item-label min-w-0">{label}</span>
    </button>
  );
}
