import type { JSX } from 'react';
import type { AppSubmenuItemSnapshot } from '@harborclient/core/types';

/**
 * A non-nested application submenu entry (separator, normal, or checkbox row).
 */
type LeafItem = Exclude<AppSubmenuItemSnapshot, { kind: 'submenu' }>;

interface Props {
  /** Snapshot entry to render. */
  item: LeafItem;
  /** Invoked when an enabled row is activated. */
  onActivate: () => void;
}

/**
 * Renders a single leaf row of a themed Linux application submenu.
 *
 * Separators render as a divider; normal and checkbox rows render as buttons
 * that call {@link Props.onActivate} when enabled.
 *
 * @param props - Item snapshot and activation handler.
 * @returns The rendered row, or a separator element.
 */
export function LinuxAppSubmenuLeaf({ item, onActivate }: Props): JSX.Element {
  if (item.kind === 'separator') {
    return <div role="separator" className="my-1 border-t border-separator" />;
  }

  const itemClass = item.enabled
    ? 'flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-text hover:bg-selection'
    : 'flex w-full cursor-default items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-text-secondary opacity-60';

  return (
    <button
      type="button"
      role="menuitem"
      disabled={!item.enabled}
      aria-checked={item.kind === 'checkbox' ? item.checked === true : undefined}
      className={itemClass}
      onClick={() => {
        if (!item.enabled) {
          return;
        }
        onActivate();
      }}
    >
      <span className="w-4 shrink-0 text-center" aria-hidden="true">
        {item.kind === 'checkbox' && item.checked ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.accelerator ? (
        <span className="shrink-0 pl-4 text-text-secondary">{item.accelerator}</span>
      ) : null}
    </button>
  );
}
