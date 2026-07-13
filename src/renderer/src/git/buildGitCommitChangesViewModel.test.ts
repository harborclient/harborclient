import { describe, expect, it } from 'vitest';
import type { GitCommitFileChange } from '#/shared/types';
import { buildGitCommitChangesViewModel } from '#/renderer/src/git/buildGitCommitChangesViewModel';

describe('buildGitCommitChangesViewModel', () => {
  const collectionFile: GitCommitFileChange = {
    kind: 'file',
    path: '.harborclient/collection-api.json',
    status: 'modified'
  };

  const markdownFile: GitCommitFileChange = {
    kind: 'file',
    path: '.harborclient/README.md',
    status: 'modified'
  };

  const plainFile: GitCommitFileChange = {
    kind: 'file',
    path: '.harborclient/.gitignore',
    status: 'added'
  };

  it('returns sorted file rows for flat harbor layout changes', () => {
    const files: GitCommitFileChange[] = [collectionFile, plainFile, markdownFile];
    const viewModel = buildGitCommitChangesViewModel(files);

    expect(viewModel.files).toEqual([plainFile, collectionFile, markdownFile]);
  });

  it('returns an empty file list for an empty commit detail payload', () => {
    expect(buildGitCommitChangesViewModel([])).toEqual({
      files: []
    });
  });
});
