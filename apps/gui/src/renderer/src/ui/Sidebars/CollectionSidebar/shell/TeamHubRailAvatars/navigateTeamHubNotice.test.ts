import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Collection, Folder, SavedRequest, TeamHubNotice } from '@harborclient/core/types';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { navigateTeamHubNotice } from './navigateTeamHubNotice';

/**
 * Builds a minimal notice fixture for navigation tests.
 *
 * @param overrides - Partial notice fields to override defaults.
 */
function sampleNotice(overrides: Partial<TeamHubNotice> = {}): TeamHubNotice {
  return {
    id: 'notice-1',
    eventType: 'discussion.mention',
    entityType: 'request',
    entityId: 'request-uuid',
    requestId: 'request-uuid',
    collectionId: 'collection-uuid',
    folderId: null,
    runResultId: null,
    discussionThreadId: 'comment-root',
    discussionCommentId: 'comment-2',
    actor: { id: 'user-2', name: 'Peer' },
    createdAt: '2026-01-02T00:00:00.000Z',
    readAt: null,
    displayMetadata: {
      actorName: 'Peer',
      targetLabel: 'Get users',
      method: 'GET',
      requestName: 'Get users'
    },
    ...overrides
  };
}

describe('navigateTeamHubNotice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const collections: Collection[] = [
    {
      id: 1,
      name: 'API',
      uuid: 'collection-uuid',
      connectionId: 'hub-1'
    } as Collection
  ];

  const requestsByCollection: Record<number, SavedRequest[]> = {
    1: [
      {
        id: 10,
        uuid: 'request-uuid',
        name: 'Get users',
        collectionId: 1
      } as unknown as SavedRequest
    ]
  };

  const foldersByCollection: Record<number, Folder[]> = {
    1: [
      {
        id: 20,
        uuid: 'folder-uuid',
        name: 'Auth',
        collectionId: 1
      } as unknown as Folder
    ]
  };

  it('opens a request and focuses the comment tab', async () => {
    const dispatch = vi.fn(async (action: unknown) => action);
    const setRequestEditorTab = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('window', { api: { setRequestEditorTab } });

    const ok = await navigateTeamHubNotice(dispatch as never, 'hub-1', sampleNotice(), {
      collections,
      requestsByCollection,
      foldersByCollection
    });

    expect(ok).toBe(true);
    expect(setRequestEditorTab).toHaveBeenCalledWith('10', 'comment');
  });

  it('opens a collection discuss tab using collection refs', async () => {
    const dispatch = vi.fn((action: unknown) => action);

    const ok = await navigateTeamHubNotice(
      dispatch as never,
      'hub-1',
      sampleNotice({
        eventType: 'discussion.comment',
        entityType: 'collection',
        entityId: 'collection-uuid',
        requestId: null
      }),
      { collections, requestsByCollection, foldersByCollection }
    );

    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      openPageTab({ type: 'collection', id: 1, focusSection: 'discuss' })
    );
  });

  it('opens a folder discuss tab using folder refs', async () => {
    const dispatch = vi.fn((action: unknown) => action);

    const ok = await navigateTeamHubNotice(
      dispatch as never,
      'hub-1',
      sampleNotice({
        eventType: 'discussion.comment',
        entityType: 'folder',
        entityId: 'folder-uuid',
        folderId: 'folder-uuid',
        requestId: null
      }),
      { collections, requestsByCollection, foldersByCollection }
    );

    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      openPageTab({
        type: 'folder',
        collectionId: 1,
        id: 20,
        focusSection: 'discuss'
      })
    );
  });

  it('returns false when the request cannot be resolved locally', async () => {
    const dispatch = vi.fn(async (action: unknown) => action);

    const ok = await navigateTeamHubNotice(
      dispatch as never,
      'hub-1',
      sampleNotice({ requestId: 'missing-request', entityId: 'missing-request' }),
      { collections, requestsByCollection, foldersByCollection }
    );

    expect(ok).toBe(false);
  });
});
