import { useEffect, useRef, useState, type JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faChevronRight } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Current request name.
   */
  name: string;

  /**
   * Name of the collection this request belongs to, for display as a breadcrumb prefix.
   */
  collectionName?: string;

  /**
   * Name of the folder this request belongs to, for display as a breadcrumb segment.
   */
  folderName?: string;

  /**
   * Called when the request name changes.
   */
  onNameChange: (name: string) => void;
}

interface BreadcrumbPrefixProps {
  /**
   * Collection segment for the breadcrumb.
   */
  collectionName?: string;

  /**
   * Folder segment for the breadcrumb.
   */
  folderName?: string;

  /**
   * When true, uses compact separators for inline edit mode.
   */
  compact?: boolean;
}

/**
 * Renders collection and optional folder breadcrumb segments.
 */
function BreadcrumbPrefix({
  collectionName,
  folderName,
  compact = false
}: BreadcrumbPrefixProps): JSX.Element | null {
  if (!collectionName && !folderName) return null;

  const segmentClass = compact
    ? 'shrink-0 text-[15px] font-normal text-muted'
    : 'font-normal text-muted';
  const separator = (
    <FaIcon
      icon={faChevronRight}
      className="inline-block h-3 w-3 shrink-0 align-middle text-muted"
    />
  );

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {collectionName && (
        <>
          <span className={segmentClass}>{collectionName}</span>
          {separator}
        </>
      )}
      {folderName && (
        <>
          <span className={segmentClass}>{folderName}</span>
          {separator}
        </>
      )}
    </span>
  );
}

/**
 * Inline-editable request name with optional collection and folder breadcrumb.
 */
export function Name({ name, collectionName, folderName, onNameChange }: Props): JSX.Element {
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  return (
    <div className="mb-2">
      {editingName ? (
        <div className="flex min-w-0 max-w-xs items-center gap-1">
          <BreadcrumbPrefix collectionName={collectionName} folderName={folderName} compact />
          <input
            ref={nameInputRef}
            className="min-w-0 flex-1 border-none bg-transparent p-0 text-[15px] font-semibold text-text outline-none app-no-drag"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                setEditingName(false);
              }
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex min-w-0 max-w-xs cursor-text items-center gap-1 border-none bg-transparent p-0 text-left text-[15px] font-semibold text-text hover:opacity-80 app-no-drag"
          onClick={() => setEditingName(true)}
        >
          <BreadcrumbPrefix collectionName={collectionName} folderName={folderName} />
          {name ? name : <span className="text-muted">Request name</span>}
        </button>
      )}
    </div>
  );
}
