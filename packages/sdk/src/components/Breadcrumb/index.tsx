import { type JSX, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../utils.js';
import { CrumbSegment } from './CrumbSegment.js';
import { EditableSegment } from './EditableSegment.js';
import { type SegmentShape } from './SegmentShell.js';
import { type BreadcrumbSegment } from './types.js';

export type { BreadcrumbSegment } from './types.js';

interface Props {
  /**
   * Leading, non-editable crumbs (collection, folder, and so on).
   */
  segments: BreadcrumbSegment[];

  /**
   * Current value of the trailing, inline-editable segment.
   */
  value: string;

  /**
   * Placeholder shown when the editable value is empty.
   */
  placeholder?: string;

  /**
   * Accessible name for the editable trailing segment input.
   */
  editableLabel?: string;

  /**
   * Called when the editable trailing segment changes.
   */
  onValueChange: (value: string) => void;

  /**
   * Additional classes merged onto the outer breadcrumb bar.
   */
  className?: string;

  /**
   * When true, applies negative horizontal and top margins so the bar sits
   * flush against the edges of a parent with `p-3` padding.
   */
  flush?: boolean;
}

/**
 * Full-width breadcrumb bar with interlocking arrow-shaped segments. Leading
 * segments are optionally clickable; the trailing segment is inline-editable.
 */
export function Breadcrumb({
  segments,
  value,
  placeholder = '',
  editableLabel = 'Name',
  onValueChange,
  className,
  flush = false
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navId = useId();

  /**
   * Focuses and selects the trailing input when inline edit mode opens.
   */
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  /**
   * Resolves the clip-path shape for a leading segment at the given index.
   *
   * @param index - Zero-based index within the leading segments array.
   * @returns Shape token used by the segment shell.
   */
  const leadingShape = (index: number): SegmentShape => {
    if (segments.length === 1) return 'first';
    if (index === 0) return 'first';
    return 'middle';
  };

  const editableShape: SegmentShape = segments.length === 0 ? 'only' : 'last';

  return (
    <nav
      id={navId}
      aria-label="Breadcrumb"
      className={cn(
        'hc-breadcrumb flex min-w-0 items-stretch bg-breadcrumb-background',
        flush ? '-mx-3 -mt-3 w-[calc(100%+1.5rem)]' : 'w-full',
        className
      )}
    >
      {segments.map((segment, index) => (
        <CrumbSegment
          key={segment.id ?? `${segment.label}-${index}`}
          segment={segment}
          shape={leadingShape(index)}
        />
      ))}
      <EditableSegment
        value={value}
        placeholder={placeholder}
        editableLabel={editableLabel}
        editing={editing}
        shape={editableShape}
        inputRef={inputRef}
        onStartEditing={() => setEditing(true)}
        onStopEditing={() => setEditing(false)}
        onValueChange={onValueChange}
      />
    </nav>
  );
}
