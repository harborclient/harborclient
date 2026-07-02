import type { JSX, MouseEvent } from 'react';

interface Props {
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

  /**
   * Called when the collection segment is clicked.
   */
  onCollectionClick?: () => void;

  /**
   * Called when the folder segment is clicked.
   */
  onFolderClick?: () => void;
}

/**
 * Renders collection and optional folder breadcrumb segments.
 */
export function BreadcrumbPrefix({
  collectionName,
  folderName,
  compact = false,
  onCollectionClick,
  onFolderClick
}: Props): JSX.Element | null {
  if (!collectionName && !folderName) return null;

  const segmentClass = compact
    ? 'truncate text-[15px] font-normal text-muted hover:text-text'
    : 'truncate font-normal text-muted hover:text-text';
  const separator = (
    <svg
      aria-hidden="true"
      focusable="false"
      className="inline-block h-3 w-3 shrink-0 align-middle text-muted"
      viewBox="0 0 320 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M311.1 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L243.2 256 73.9 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"
      />
    </svg>
  );

  /**
   * Stops click propagation so breadcrumb navigation does not trigger name edit mode.
   *
   * @param event - Mouse event from a breadcrumb segment control.
   * @param handler - Segment-specific click handler.
   */
  const handleSegmentClick = (event: MouseEvent, handler?: () => void): void => {
    event.stopPropagation();
    handler?.();
  };

  return (
    <span className="inline-flex min-w-0 shrink items-center gap-1 overflow-hidden">
      {collectionName &&
        (onCollectionClick ? (
          <>
            <button
              type="button"
              className={`${segmentClass} max-w-full shrink cursor-pointer border-none bg-transparent p-0 app-no-drag`}
              onClick={(event) => handleSegmentClick(event, onCollectionClick)}
            >
              {collectionName}
            </button>
            {separator}
          </>
        ) : (
          <>
            <span className={segmentClass}>{collectionName}</span>
            {separator}
          </>
        ))}
      {folderName &&
        (onFolderClick ? (
          <>
            <button
              type="button"
              className={`${segmentClass} max-w-full shrink cursor-pointer border-none bg-transparent p-0 app-no-drag`}
              onClick={(event) => handleSegmentClick(event, onFolderClick)}
            >
              {folderName}
            </button>
            {separator}
          </>
        ) : (
          <>
            <span className={segmentClass}>{folderName}</span>
            {separator}
          </>
        ))}
    </span>
  );
}
