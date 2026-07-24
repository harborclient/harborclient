import type { JSX } from 'react';

interface Props {
  /**
   * Collection segment shown before the result title.
   */
  collectionName?: string;

  /**
   * Optional folder segment shown after the collection.
   */
  folderName?: string;
}

/**
 * Compact read-only breadcrumb prefix for Action menu search result rows.
 */
export function InlineBreadcrumbPrefix({ collectionName, folderName }: Props): JSX.Element | null {
  if (!collectionName && !folderName) return null;

  const separator = (
    <span aria-hidden="true" className="shrink-0 text-muted">
      /
    </span>
  );

  return (
    <span className="inline-flex min-w-0 shrink items-center gap-1 overflow-hidden text-muted">
      {collectionName ? (
        <>
          <span className="truncate">{collectionName}</span>
          {separator}
        </>
      ) : null}
      {folderName ? (
        <>
          <span className="truncate">{folderName}</span>
          {separator}
        </>
      ) : null}
    </span>
  );
}
