import { Input } from '@harborclient/sdk/components';
import { useEffect, useRef, type JSX, type KeyboardEvent } from 'react';
import type { TerminalTab } from '#/renderer/src/store/slices/terminalsSlice';

interface Props {
  /**
   * Terminal tab metadata shown in the vertical switcher.
   */
  terminal: TerminalTab;

  /**
   * Whether this tab is the active selection.
   */
  selected: boolean;

  /**
   * Zero-based index within the tab list for keyboard navigation.
   */
  index: number;

  /**
   * Whether this tab is currently being renamed inline.
   */
  editing: boolean;

  /**
   * Draft title shown while inline rename is active.
   */
  draftTitle: string;

  /**
   * Activates this terminal tab.
   */
  onSelect: () => void;

  /**
   * Enters inline rename mode for this tab.
   */
  onStartEdit: () => void;

  /**
   * Updates the draft title while the user types.
   */
  onDraftChange: (title: string) => void;

  /**
   * Commits the draft title and exits rename mode.
   */
  onCommit: () => void;

  /**
   * Discards the draft title and exits rename mode.
   */
  onCancel: () => void;

  /**
   * Handles arrow-key navigation between tabs when not editing.
   */
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
}

/**
 * Returns Tailwind classes for one terminal tab row in view or edit mode.
 *
 * @param selected - Whether the tab is currently active.
 */
function tabRowClassName(selected: boolean): string {
  return selected
    ? 'rounded-md bg-selection px-3 py-2 text-left text-[16px] text-text'
    : 'rounded-md px-3 py-2 text-left text-[16px] text-muted hover:bg-selection/60 hover:text-text';
}

/**
 * One terminal tab in the vertical switcher, with double-click inline rename.
 */
export function TerminalTabButton({
  terminal,
  selected,
  index,
  editing,
  draftTitle,
  onSelect,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
  onKeyDown
}: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);

  /**
   * Focuses and selects the rename input when inline edit mode opens.
   */
  useEffect(() => {
    if (!editing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <div
        id={`footer-terminal-tab-${terminal.id}`}
        role="tab"
        aria-selected={selected}
        aria-controls={`footer-terminal-panel-${terminal.id}`}
        tabIndex={selected ? 0 : -1}
        className={tabRowClassName(selected)}
      >
        <Input
          ref={inputRef}
          variant="plain"
          className="w-full min-w-0 border-none bg-transparent p-0 text-[16px] text-text outline-none app-no-drag"
          type="text"
          value={draftTitle}
          aria-label="Rename terminal tab"
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={() => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
              return;
            }

            onCommit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommit();
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              skipBlurCommitRef.current = true;
              onCancel();
            }
          }}
        />
      </div>
    );
  }

  return (
    <button
      id={`footer-terminal-tab-${terminal.id}`}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`footer-terminal-panel-${terminal.id}`}
      tabIndex={selected ? 0 : -1}
      className={tabRowClassName(selected)}
      onClick={onSelect}
      onDoubleClick={onStartEdit}
      onKeyDown={(event) => onKeyDown(event, index)}
    >
      <span className="block truncate">{terminal.title}</span>
    </button>
  );
}
