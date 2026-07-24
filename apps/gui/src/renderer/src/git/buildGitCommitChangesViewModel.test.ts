import { describe, expect, it } from 'vitest';
import type { GitCommitFileChange } from '#/shared/types';
import { buildGitCommitChangesViewModel } from './buildGitCommitChangesViewModel';

describe('buildGitCommitChangesViewModel', () => {
  const requestFile: GitCommitFileChange = {
    kind: 'file',
    path: '.harborclient/collection-api/req-health.json',
    status: 'modified',
    displayName: 'Health Check',
    resourceKind: 'request',
    method: 'GET'
  };

  const markdownFile: GitCommitFileChange = {
    kind: 'file',
    path: '.harborclient/collection-api/README.md',
    status: 'modified',
    displayName: 'README',
    resourceKind: 'document'
  };

  const plainFile: GitCommitFileChange = {
    kind: 'file',
    path: '.harborclient/environment-staging.json',
    status: 'added'
  };

  it('returns sorted file rows for collection folder changes', () => {
    const files: GitCommitFileChange[] = [requestFile, plainFile, markdownFile];
    const viewModel = buildGitCommitChangesViewModel(files);

    expect(viewModel.files).toEqual([markdownFile, requestFile, plainFile]);
  });

  it('returns an empty file list for an empty commit detail payload', () => {
    expect(buildGitCommitChangesViewModel([])).toEqual({
      files: []
    });
  });
});
