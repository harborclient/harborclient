import type { JSX } from 'react';
import type { GitRequestDiffFileEntry } from '#/shared/types';

interface Props {
  /**
   * Changed file entry to summarize.
   */
  file: GitRequestDiffFileEntry;
}

/**
 * Renders one changed file path and status summary above the diff panes.
 */
export function GitDiffFileSummary({ file }: Props): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 text-[14px] font-medium text-text">
        {file.status}: {file.path}
        {file.binary ? ' (binary)' : ''}
      </p>
      {file.renamedFrom != null ? (
        <p className="m-0 text-[14px] text-muted">Renamed from {file.renamedFrom}</p>
      ) : null}
      {file.truncated ? (
        <p className="m-0 text-[14px] text-muted" role="status">
          Diff truncated; showing an excerpt of this file.
        </p>
      ) : null}
    </div>
  );
}
