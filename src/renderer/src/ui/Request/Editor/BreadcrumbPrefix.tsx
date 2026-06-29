import { FaIcon } from '@harborclient/sdk/components';
import type { JSX, MouseEvent } from 'react';

import { faChevronRight } from '#/renderer/src/fontawesome';

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
    <FaIcon
      icon={faChevronRight}
      className="inline-block h-3 w-3 shrink-0 align-middle text-muted"
    />
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
