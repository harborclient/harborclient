import { describe, expect, it } from 'vitest';
import type {
  GitCommitDocumentChange,
  GitCommitFileChange,
  GitCommitRequestChange
} from '#/shared/types';
import { buildGitCommitChangesViewModel } from '#/renderer/src/git/buildGitCommitChangesViewModel';

describe('buildGitCommitChangesViewModel', () => {
  const requestA: GitCommitRequestChange = {
    kind: 'request',
    path: '.harborclient/collections/uuid-a-demo/requests/uuid-req-a-get-users.json',
    paths: ['.harborclient/collections/uuid-a-demo/requests/uuid-req-a-get-users.json'],
    status: 'added',
    collectionUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    requestUuid: '11111111-2222-3333-4444-555555555555',
    name: 'Beta Request',
    method: 'GET',
    color: null
  };

  const requestB: GitCommitRequestChange = {
    kind: 'request',
    path: '.harborclient/collections/uuid-a-demo/requests/uuid-req-b-post-users.json',
    paths: ['.harborclient/collections/uuid-a-demo/requests/uuid-req-b-post-users.json'],
    status: 'modified',
    collectionUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    requestUuid: '22222222-3333-4444-5555-666666666666',
    name: 'Alpha Request',
    method: 'POST',
    color: '#32D2E2'
  };

  const document: GitCommitDocumentChange = {
    kind: 'document',
    path: '.harborclient/README.md',
    paths: ['.harborclient/README.md'],
    status: 'modified',
    collectionUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    documentUuid: '33333333-4444-5555-6666-777777777777',
    name: 'README.md',
    color: null
  };

  const plainFile: GitCommitFileChange = {
    kind: 'file',
    path: '.harborclient/.gitignore',
    status: 'added'
  };

  it('groups requests and documents while omitting internal HarborClient files', () => {
    const files: GitCommitFileChange[] = [plainFile, document, requestA, requestB];
    const viewModel = buildGitCommitChangesViewModel(files);

    expect(viewModel.requests).toEqual([requestB, requestA]);
    expect(viewModel.documents).toEqual([document]);
  });

  it('returns empty groups for an empty file list', () => {
    expect(buildGitCommitChangesViewModel([])).toEqual({
      requests: [],
      documents: []
    });
  });
});
