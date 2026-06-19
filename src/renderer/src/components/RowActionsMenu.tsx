import { useEffect, useRef, type JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faBars } from '#/renderer/src/fontawesome';
import { iconButton } from '#/renderer/src/ui/classes';

type MenuItem = {
  label: string;
  onSelect: () => void;
  variant?: 'default' | 'danger';
};

interface Props {
  /**
   * Menu entries shown when the trigger is open.
   */
  items: MenuItem[];

  /**
   * Unique id for this menu instance (e.g. "collection-3").
   */
  menuId: string;

  /**
   * Id of the currently open menu, or null when all are closed.
   */
  openMenuId: string | null;

  /**
   * Called when the user opens or closes a menu.
   *
   * @param id - Open menu id, or null to close.
   */
  onOpenChange: (id: string | null) => void;
}

/**
 * Hamburger-triggered dropdown for row-level actions (rename, delete, etc.).
 */
export function RowActionsMenu({ items, menuId, openMenuId, onOpenChange }: Props): JSX.Element {
  const isOpen = openMenuId === menuId;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onOpenChange(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={`${iconButton} ${isOpen ? 'opacity-100' : ''}`}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(isOpen ? null : menuId);
        }}
      >
        <FaIcon icon={faBars} className="h-3.5 w-3.5" />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-0.5 min-w-[120px] rounded-md border border-separator bg-surface py-0.5 shadow-md app-no-drag"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={
                item.variant === 'danger'
                  ? 'block w-full cursor-pointer border-none bg-transparent px-3 py-1 text-left text-[13px] text-text hover:bg-danger/15 hover:text-danger app-no-drag'
                  : 'block w-full cursor-pointer border-none bg-transparent px-3 py-1 text-left text-[13px] text-text hover:bg-selection app-no-drag'
              }
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(null);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
