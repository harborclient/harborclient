import type { JSX, RefObject } from 'react';
import { Input } from '../forms/index.js';
import { type SegmentShape, SegmentShell } from './SegmentShell.js';

interface Props {
  /**
   * Current editable value.
   */
  value: string;

  /**
   * Placeholder when the value is empty.
   */
  placeholder: string;

  /**
   * Accessible name for the editable input.
   */
  editableLabel: string;

  /**
   * Whether inline edit mode is active.
   */
  editing: boolean;

  /**
   * Segment position within the bar.
   */
  shape: SegmentShape;

  /**
   * Ref forwarded to the inline input when editing.
   */
  inputRef: RefObject<HTMLInputElement | null>;

  /**
   * Opens inline edit mode for the trailing segment.
   */
  onStartEditing: () => void;

  /**
   * Closes inline edit mode for the trailing segment.
   */
  onStopEditing: () => void;

  /**
   * Called when the editable value changes.
   */
  onValueChange: (value: string) => void;
}

/**
 * Renders the trailing breadcrumb segment with click-to-edit behavior.
 */
export function EditableSegment({
  value,
  placeholder,
  editableLabel,
  editing,
  shape,
  inputRef,
  onStartEditing,
  onStopEditing,
  onValueChange
}: Props): JSX.Element {
  return (
    <SegmentShell shape={shape} grow>
      {editing ? (
        <Input
          ref={inputRef}
          variant="plain"
          aria-label={editableLabel}
          className="app-no-drag w-full min-w-0 border-none bg-transparent p-0 font-semibold text-text outline-none"
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={onStopEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault();
              onStopEditing();
            }
          }}
        />
      ) : (
        <button
          type="button"
          aria-current="page"
          aria-label={editableLabel}
          className="app-no-drag flex w-full min-w-0 cursor-text items-center border-none bg-transparent p-0 text-left font-semibold text-text hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          onClick={onStartEditing}
        >
          <span className="min-w-0 truncate">
            {value ? value : <span className="font-normal text-muted">{placeholder}</span>}
          </span>
        </button>
      )}
    </SegmentShell>
  );
}
