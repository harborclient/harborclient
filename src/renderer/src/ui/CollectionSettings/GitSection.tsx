import type { JSX } from 'react';
import type { StorageConnection } from '#/shared/types';

import { GitFields } from '#/renderer/src/ui/Settings/StorageLocationsSection/GitFields';

interface Props {
  /**
   * Git connection backing this collection.
   */
  connection: StorageConnection & { type: 'git' };

  /**
   * Whether settings inputs are disabled while the parent form saves.
   */
  disabled?: boolean;

  /**
   * Called when repository or authentication fields change.
   */
  onChange: (connection: StorageConnection & { type: 'git' }) => void;

  /**
   * Called when the initialize-git-repository checkbox changes.
   */
  onInitGitRepoChange?: (checked: boolean) => void;
}

/**
 * Repository and authentication settings for a git-backed collection.
 */
export function GitSection({
  connection,
  disabled = false,
  onChange,
  onInitGitRepoChange
}: Props): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <p className="m-0 text-muted">
        This collection is stored in a git repository. Update the remote, branch, or credentials
        here. Push and pull controls stay in the collection sidebar.
      </p>
      <GitFields
        connection={connection}
        disabled={disabled}
        onInitGitRepoChange={onInitGitRepoChange}
        onChange={(next) => {
          if (next.type === 'git') {
            onChange(next);
          }
        }}
      />
    </div>
  );
}
