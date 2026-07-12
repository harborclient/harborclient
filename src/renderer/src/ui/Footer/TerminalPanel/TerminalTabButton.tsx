import { Input, RoundButton } from '@harborclient/sdk/components';
import { useEffect, useRef, type JSX, type KeyboardEvent } from 'react';
import { faXmark } from '#/renderer/src/fontawesome';
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
   * Closes this terminal tab.
   */
  onClose: () => void;

  /**
   * Handles arrow-key navigation between tabs when not editing.
   */
  onKeyDown: (event: KeyboardEvent<HTMLElement>, index: number) => void;
}

/**
 * Returns Tailwind classes for one terminal tab row in view or edit mode.
 *
 * @param selected - Whether the tab is currently active.
 */
function tabRowClassName(selected: boolean): string {
  return selected
    ? 'rounded-md bg-selection px-3 py-2 pr-1 text-left text-text'
    : 'rounded-md px-3 py-2 pr-1 text-left text-muted hover:bg-selection/60 hover:text-text';
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
  onClose,
  onKeyDown
}: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const closeLabel = `Close ${terminal.title}`;

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

  /**
   * Activates this tab when the user presses Enter or Space on the tab row.
   *
   * @param event - Keyboard event from the tab element.
   */
  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
      return;
    }

    onKeyDown(event, index);
  };

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
          className="w-full min-w-0 border-none bg-transparent p-0 text-text outline-none app-no-drag"
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
    <div
      id={`footer-terminal-tab-${terminal.id}`}
      role="tab"
      aria-selected={selected}
      aria-controls={`footer-terminal-panel-${terminal.id}`}
      aria-label={terminal.title}
      tabIndex={selected ? 0 : -1}
      className={`flex cursor-pointer items-center gap-1 ${tabRowClassName(selected)}`}
      onClick={onSelect}
      onDoubleClick={onStartEdit}
      onKeyDown={handleTabKeyDown}
    >
      <span className="min-w-0 flex-1 truncate">{terminal.title}</span>
      <span className="shrink-0" onPointerDown={(event) => event.stopPropagation()}>
        <RoundButton
          icon={faXmark}
          ariaLabel={closeLabel}
          title={closeLabel}
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        />
      </span>
    </div>
  );
}
