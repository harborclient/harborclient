import type { JSX, ReactNode } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faPlus } from '#/renderer/src/fontawesome';
import { toolbarButton } from '#/renderer/src/ui/classes';

interface Props {
  /**
   * Section title shown in the header.
   */
  title: string;

  /**
   * Whether the section body is expanded.
   */
  expanded: boolean;

  /**
   * Toggles section expansion.
   */
  onToggle: () => void;

  /**
   * Section body content.
   */
  children: ReactNode;

  /**
   * Called when the add button is clicked.
   */
  onAdd?: () => void;

  /**
   * Accessible label for the add button.
   */
  addLabel?: string;
}

/**
 * Collapsible sidebar section with optional add action.
 */
export function SidebarSection({
  title,
  expanded,
  onToggle,
  children,
  onAdd,
  addLabel
}: Props): JSX.Element {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-2 ps-1 py-3">
        <button
          type="button"
          className="inline-flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left app-no-drag"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[10px] text-muted">
            {expanded ? '▼' : '▶'}
          </span>
          <h2 className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">
            {title}
          </h2>
        </button>
        {onAdd && (
          <button
            title={addLabel ?? 'Add'}
            className={`${toolbarButton} inline-flex items-center gap-1`}
            onClick={onAdd}
          >
            <FaIcon icon={faPlus} className="h-3 w-3" />
          </button>
        )}
      </div>
      {expanded && children}
    </div>
  );
}
