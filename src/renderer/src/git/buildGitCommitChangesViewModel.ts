import type {
  GitCommitDocumentChange,
  GitCommitFileChange,
  GitCommitRequestChange
} from '#/shared/types';

/**
 * Grouped commit file rows for rendering in the commit details modal.
 */
export interface GitCommitChangesViewModel {
  /**
   * Request resources changed in the commit, sorted by name.
   */
  requests: GitCommitRequestChange[];

  /**
   * Markdown document resources changed in the commit, sorted by name.
   */
  documents: GitCommitDocumentChange[];
}

/**
 * Splits enriched commit file changes into request and document groups for display.
 *
 * Internal HarborClient files such as `collection.json` and `.gitignore` are omitted
 * because the modal should only surface user-facing requests and markdown documents.
 *
 * @param files - Commit file changes returned by `gitCommitDetail`.
 * @returns View-model groups for sidebar-style rendering.
 */
export function buildGitCommitChangesViewModel(
  files: GitCommitFileChange[]
): GitCommitChangesViewModel {
  const requests: GitCommitRequestChange[] = [];
  const documents: GitCommitDocumentChange[] = [];

  for (const file of files) {
    if (file.kind === 'request') {
      requests.push(file);
      continue;
    }
    if (file.kind === 'document') {
      documents.push(file);
    }
  }

  return {
    requests: requests.sort((a, b) => a.name.localeCompare(b.name)),
    documents: documents.sort((a, b) => a.name.localeCompare(b.name))
  };
}
