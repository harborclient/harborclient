import { describe, expect, it } from 'vitest';
import { resolveVariableEditTarget } from './resolveVariableEditTarget';

describe('resolveVariableEditTarget', () => {
  const baseInput = {
    key: 'apiUrl',
    globalVariables: [{ key: 'apiUrl', value: 'global', defaultValue: '', share: false }],
    collectionVariables: [{ key: 'apiUrl', value: 'collection', defaultValue: '', share: false }],
    folderVariables: [{ key: 'apiUrl', value: 'folder', defaultValue: '', share: false }],
    environmentVariables: [{ key: 'apiUrl', value: 'env', defaultValue: '', share: false }],
    activeCollectionId: 10,
    activeFolderId: 15,
    activeEnvironmentId: 20
  };

  it('returns null for an empty key', () => {
    expect(
      resolveVariableEditTarget({
        ...baseInput,
        key: '   '
      })
    ).toBeNull();
  });

  it('prefers environment scope when the key exists in all scopes', () => {
    expect(resolveVariableEditTarget(baseInput)).toEqual({
      scope: 'environment',
      environmentId: 20
    });
  });

  it('prefers collection scope when the key exists in collection and global only', () => {
    expect(
      resolveVariableEditTarget({
        ...baseInput,
        environmentVariables: [],
        folderVariables: [],
        activeFolderId: null
      })
    ).toEqual({
      scope: 'collection',
      collectionId: 10
    });
  });

  it('prefers folder scope when the key exists in folder and collection but not environment', () => {
    expect(
      resolveVariableEditTarget({
        ...baseInput,
        environmentVariables: []
      })
    ).toEqual({
      scope: 'folder',
      collectionId: 10,
      folderId: 15
    });
  });

  it('opens global settings when the key exists only in globals', () => {
    expect(
      resolveVariableEditTarget({
        ...baseInput,
        collectionVariables: [],
        folderVariables: [],
        environmentVariables: [],
        activeFolderId: null
      })
    ).toEqual({
      scope: 'global'
    });
  });

  it('falls back to the active folder when the key is undefined everywhere', () => {
    expect(
      resolveVariableEditTarget({
        ...baseInput,
        key: 'missing',
        globalVariables: [],
        collectionVariables: [],
        folderVariables: [],
        environmentVariables: []
      })
    ).toEqual({
      scope: 'folder',
      collectionId: 10,
      folderId: 15
    });
  });

  it('falls back to the active collection when no folder is active', () => {
    expect(
      resolveVariableEditTarget({
        ...baseInput,
        key: 'missing',
        activeFolderId: null,
        globalVariables: [],
        collectionVariables: [],
        folderVariables: [],
        environmentVariables: []
      })
    ).toEqual({
      scope: 'collection',
      collectionId: 10
    });
  });

  it('falls back to the active environment when no collection is active', () => {
    expect(
      resolveVariableEditTarget({
        ...baseInput,
        key: 'missing',
        activeCollectionId: null,
        globalVariables: [],
        collectionVariables: [],
        environmentVariables: []
      })
    ).toEqual({
      scope: 'environment',
      environmentId: 20
    });
  });

  it('returns null when the key is undefined and no active scope exists', () => {
    expect(
      resolveVariableEditTarget({
        ...baseInput,
        key: 'missing',
        activeCollectionId: null,
        activeEnvironmentId: null,
        globalVariables: [],
        collectionVariables: [],
        environmentVariables: []
      })
    ).toBeNull();
  });
});
