import type { GitCommitChangeStatus } from '#/shared/types';
import {
  buildGitCommitFileAccessibleName,
  gitChangeStatusMarker,
  gitChangeStatusMarkerLabel,
  gitCommitChangeNameClass,
  resolveGitChangeDisplayLabel
} from '#/renderer/src/git/gitCommitChangeDisplay';

/**
 * Minimal file shape required to render one git changed-file sidebar row.
 */
export interface GitChangedFileRowFile {
  /**
   * Repository-relative path under the HarborClient tree.
   */
  path: string;

  /**
   * Added, modified, or deleted relative to HEAD or a parent commit.
   */
  status: GitCommitChangeStatus;

  /**
   * User-facing request or document name when resolved from file contents.
   */
  displayName?: string;

  /**
   * HarborClient resource kind for request, document, and collection rows.
   */
  resourceKind?: 'request' | 'document' | 'collection';

  /**
   * HTTP method for request rows when resolved from file contents.
   */
  method?: string;
}

/**
 * Status marker props passed to sidebar row components.
 */
export interface GitChangedFileRowStatusMarkerProps {
  /**
   * Single-letter git change marker.
   */
  marker: 'A' | 'M' | 'D' | 'C';

  /**
   * Tailwind class for the marker text color.
   */
  className: string;

  /**
   * Human-readable marker label for screen readers.
   */
  label: 'Added' | 'Modified' | 'Deleted' | 'Conflict';
}

/**
 * Derived presentation values for one git changed-file sidebar row.
 */
export interface GitChangedFileRowPresentation {
  /**
   * Primary label shown in the row.
   */
  displayLabel: string;

  /**
   * Status marker props for sidebar row components.
   */
  statusMarkerProps: GitChangedFileRowStatusMarkerProps;

  /**
   * Accessible name for the row button.
   */
  rowAriaLabel: string;
}

/**
 * Builds display label, status marker, and accessible name for one git changed-file row.
 *
 * @param file - Changed file entry with path, status, and optional resource metadata.
 * @param hasConflict - Whether the file has unresolved merge conflict markers.
 * @returns Presentation values consumed by {@link GitChangedFileRow}.
 */
export function buildGitChangedFileRowPresentation(
  file: GitChangedFileRowFile,
  hasConflict: boolean
): GitChangedFileRowPresentation {
  const displayLabel = resolveGitChangeDisplayLabel(file.path, file.displayName);
  const statusMarkerProps: GitChangedFileRowStatusMarkerProps = {
    marker: gitChangeStatusMarker(file.status, hasConflict),
    className: hasConflict
      ? 'text-amber-700 dark:text-amber-300'
      : gitCommitChangeNameClass(file.status),
    label: gitChangeStatusMarkerLabel(file.status, hasConflict)
  };
  const rowAriaLabel = hasConflict
    ? `Resolve merge conflict in ${displayLabel}`
    : buildGitCommitFileAccessibleName(file.path, file.status, file.displayName, file.resourceKind);

  return {
    displayLabel,
    statusMarkerProps,
    rowAriaLabel
  };
}
