import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import {
  resolveCollectionGitContext,
  resolveGitSidebarCollectionId
} from './resolveCollectionGitContext';
import type { Collection, SourceControlStatus } from '#/shared/types';

/**
 * Returns a minimal collection for git context tests.
 *
 * @param overrides - Fields to override on the base collection.
 */
function sampleCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 1,
    uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: 'Demo',
    headers: [],
    variables: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

const gitStatus: SourceControlStatus = {
  branch: 'main',
  changedCount: 0,
  stagedCount: 0,
  unstagedCount: 0,
  ahead: 0,
  behind: 0,
  syncKnown: true,
  conflictCount: 0,
  harborRootExists: true,
  harborSubdir: '.harborclient'
};

describe('resolveCollectionGitContext', () => {
  it('returns null when no collection is selected', () => {
    expect(
      resolveCollectionGitContext({
        collectionId: null,
        collections: [sampleCollection()],
        primaryConnectionId: 'git-1',
        connectionNamesById: { 'git-1': 'Origin' },
        connectionTypesById: { 'git-1': 'git' },
        gitStatusesByConnectionId: { 'git-1': gitStatus }
      })
    ).toBeNull();
  });

  it('returns null when the selected collection is not git-backed', () => {
    expect(
      resolveCollectionGitContext({
        collectionId: 2,
        collections: [
          sampleCollection(),
          sampleCollection({ id: 2, connectionId: 'local-1', name: 'Local' })
        ],
        primaryConnectionId: 'git-1',
        connectionNamesById: { 'local-1': 'Local' },
        connectionTypesById: { 'local-1': 'sqlite' },
        gitStatusesByConnectionId: {}
      })
    ).toBeNull();
  });

  it('returns git context for a git-backed collection', () => {
    const collection = sampleCollection({ connectionId: 'git-1' });

    expect(
      resolveCollectionGitContext({
        collectionId: 1,
        collections: [collection],
        primaryConnectionId: 'fallback',
        connectionNamesById: { 'git-1': 'Origin' },
        connectionTypesById: { 'git-1': 'git' },
        gitStatusesByConnectionId: { 'git-1': gitStatus }
      })
    ).toEqual({
      connectionId: 'git-1',
      connectionName: 'Origin',
      collectionUuid: collection.uuid,
      collectionId: 1,
      collectionName: 'Demo',
      status: gitStatus
    });
  });

  it('returns git context when git status is known but provider types are still loading', () => {
    const collection = sampleCollection({ connectionId: 'git-1' });

    expect(
      resolveCollectionGitContext({
        collectionId: 1,
        collections: [collection],
        primaryConnectionId: 'fallback',
        connectionNamesById: { 'git-1': 'Origin' },
        connectionTypesById: {},
        gitStatusesByConnectionId: { 'git-1': gitStatus }
      })
    ).toEqual({
      connectionId: 'git-1',
      connectionName: 'Origin',
      collectionUuid: collection.uuid,
      collectionId: 1,
      collectionName: 'Demo',
      status: gitStatus
    });
  });
});

describe('resolveGitSidebarCollectionId', () => {
  it('prefers the sidebar-selected collection over the active draft', () => {
    expect(resolveGitSidebarCollectionId(5, 9)).toBe(5);
  });

  it('falls back to the draft collection when nothing is selected', () => {
    expect(resolveGitSidebarCollectionId(null, 9)).toBe(9);
  });

  it('returns null when neither selection nor draft provide a collection', () => {
    expect(resolveGitSidebarCollectionId(null, undefined)).toBeNull();
  });
});
