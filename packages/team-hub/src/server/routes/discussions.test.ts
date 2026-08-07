import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { DeviceKeyRecord, DiscussionCommentRecord } from '#/db/types.js';
import { hashDeviceKeyFingerprint } from '#/db/deviceKeyLogic.js';
import { buildEncryptedDiscussionCommentFields } from '#/db/discussionEncryptedPayload.js';
import {
  authHeader,
  createProtectedTestApp,
  sampleUserRecord
} from '#/server/routes/test/createTestApp.js';

const sampleDeviceId = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Builds a device key fixture for E2EE discussion route tests.
 */
function sampleDeviceKey(): DeviceKeyRecord {
  const publicKeyMaterial = 'dGVzdC1rZXk=';
  return {
    id: 'device-key-1',
    userId: sampleUserRecord.id,
    deviceId: sampleDeviceId,
    label: 'Test device',
    keyFormat: 'identity-v1',
    publicKeyMaterial,
    fingerprint: hashDeviceKeyFingerprint(publicKeyMaterial),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastSeenAt: null,
    revokedAt: null,
    createdByUserId: sampleUserRecord.id,
    updatedByUserId: sampleUserRecord.id
  };
}

/**
 * Builds an encrypted payload accepted by E2EE discussion write routes.
 */
function sampleEncryptedPayloadInput() {
  const fields = buildEncryptedDiscussionCommentFields({
    ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
    mlsGroupId: 'thread:request:request-1',
    epoch: 0,
    senderDeviceId: sampleDeviceId,
    keyFormat: 'identity-v1'
  });

  return {
    encryptedPayload: {
      ciphertext: fields.body,
      mlsGroupId: 'thread:request:request-1',
      epoch: 0,
      senderDeviceId: sampleDeviceId,
      keyFormat: 'identity-v1' as const
    },
    fields
  };
}

/**
 * Builds a discussion comment fixture for route tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Discussion comment record fixture.
 */
function sampleDiscussionComment(
  overrides: Partial<DiscussionCommentRecord> = {}
): DiscussionCommentRecord {
  return {
    id: 'comment-1',
    targetEntityType: 'request',
    targetEntityId: 'request-1',
    parentCommentId: null,
    rootCommentId: 'comment-1',
    depth: 1,
    body: 'Looks good',
    bodyFormat: 'plaintext',
    bodyMetadata: null,
    authorUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    tombstonedAt: null,
    tombstonedByUserId: null,
    ...overrides
  };
}

const sampleRequest = {
  id: 'request-1',
  collectionId: 'collection-1',
  name: 'Get users',
  protocol: 'http' as const,
  method: 'GET' as const,
  url: 'https://example.test/users',
  headers: [],
  params: [],
  auth: { type: 'none' as const, basic: { username: '', password: '' }, bearer: { token: '' } },
  body: '',
  bodyType: 'none' as const,
  preRequestScript: '',
  postRequestScript: '',
  comment: 'Legacy note stays separate',
  folderId: null,
  sortOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdByUserId: 'user-1',
  updatedByUserId: 'user-1',
  marker: null
};

describe('discussion routes', () => {
  it('lists request discussions when the user can access the collection', async () => {
    const db = createStubDatabase();
    const comment = sampleDiscussionComment();
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.listDiscussionComments.mockResolvedValue({ comments: [comment], nextCursor: null });
    db.findUserById.mockResolvedValue(sampleUserRecord);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'GET',
      url: '/requests/request-1/discussions',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(db.listDiscussionComments).toHaveBeenCalledWith({
      targetEntityType: 'request',
      targetEntityId: 'request-1',
      cursor: undefined,
      limit: undefined
    });
    expect(response.json().comments[0].body).toBe('Looks good');
    expect(response.json().comments[0].author).toEqual({
      id: 'user-1',
      name: 'Test user',
      avatar: {
        initials: 'TU',
        color: 'sky-600'
      }
    });

    await app.close();
  });

  it('creates top-level collection discussions', async () => {
    const db = createStubDatabase();
    db.findCollectionById.mockResolvedValue({
      id: 'collection-1',
      name: 'API',
      variables: [],
      headers: [],
      auth: { type: 'none', basic: { username: '', password: '' }, bearer: { token: '' } },
      preRequestScript: '',
      postRequestScript: '',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      deletionLocked: false,
      marker: null
    });
    db.createDiscussionComment.mockResolvedValue(
      sampleDiscussionComment({
        id: 'comment-2',
        targetEntityType: 'collection',
        targetEntityId: 'collection-1',
        body: 'Ship it'
      })
    );
    db.findUserById.mockResolvedValue(sampleUserRecord);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'POST',
      url: '/collections/collection-1/discussions',
      headers: authHeader(),
      payload: { body: 'Ship it' }
    });

    expect(response.statusCode).toBe(200);
    expect(db.createDiscussionComment).toHaveBeenCalledWith(
      {
        targetEntityType: 'collection',
        targetEntityId: 'collection-1',
        body: 'Ship it',
        bodyFormat: 'plaintext',
        bodyMetadata: null
      },
      'user-1'
    );

    await app.close();
  });

  it('creates folder and run-result discussions', async () => {
    const db = createStubDatabase();
    db.findFolderById.mockResolvedValue({
      id: 'folder-1',
      collectionId: 'collection-1',
      parentFolderId: null,
      name: 'Auth',
      sortOrder: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      marker: null
    });
    db.findRunResultById.mockResolvedValue({
      id: 'run-1',
      kind: 'request-run-results',
      label: 'Run',
      collectionName: 'API',
      requestName: 'Get users',
      summary: { passed: 1, failed: 0, skipped: 0 },
      payload: {},
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      createdByUserId: 'user-1'
    });
    db.createDiscussionComment
      .mockResolvedValueOnce(
        sampleDiscussionComment({
          targetEntityType: 'folder',
          targetEntityId: 'folder-1'
        })
      )
      .mockResolvedValueOnce(
        sampleDiscussionComment({
          targetEntityType: 'runResult',
          targetEntityId: 'run-1'
        })
      );
    db.findUserById.mockResolvedValue(sampleUserRecord);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const folderResponse = await app.inject({
      method: 'POST',
      url: '/folders/folder-1/discussions',
      headers: authHeader(),
      payload: { body: 'Folder thread' }
    });
    const runResponse = await app.inject({
      method: 'POST',
      url: '/run-results/run-1/discussions',
      headers: authHeader(),
      payload: { body: 'Run thread' }
    });

    expect(folderResponse.statusCode).toBe(200);
    expect(runResponse.statusCode).toBe(200);

    await app.close();
  });

  it('returns flattened depth metadata for replies', async () => {
    const db = createStubDatabase();
    const parent = sampleDiscussionComment({
      id: 'depth-3',
      depth: 3,
      parentCommentId: 'depth-2',
      rootCommentId: 'root-1'
    });
    db.findDiscussionCommentById.mockResolvedValue(parent);
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.createDiscussionComment.mockResolvedValue(
      sampleDiscussionComment({
        id: 'reply-flat',
        depth: 3,
        parentCommentId: 'depth-2',
        rootCommentId: 'root-1',
        body: 'Still depth 3'
      })
    );
    db.findUserById.mockResolvedValue(sampleUserRecord);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'POST',
      url: '/discussion-comments/depth-3/replies',
      headers: authHeader(),
      payload: { body: 'Still depth 3' }
    });

    expect(response.statusCode).toBe(200);
    expect(db.createDiscussionComment).toHaveBeenCalledWith(
      {
        targetEntityType: 'request',
        targetEntityId: 'request-1',
        body: 'Still depth 3',
        bodyFormat: 'plaintext',
        bodyMetadata: null,
        parentCommentId: 'depth-3'
      },
      'user-1'
    );
    expect(response.json().depth).toBe(3);
    expect(response.json().parentCommentId).toBe('depth-2');

    await app.close();
  });

  it('hides tombstoned bodies while keeping thread metadata', async () => {
    const db = createStubDatabase();
    const tombstoned = sampleDiscussionComment({
      body: '',
      tombstonedAt: new Date('2026-01-02T00:00:00.000Z'),
      tombstonedByUserId: 'user-1'
    });
    db.findDiscussionCommentById.mockResolvedValue(tombstoned);
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.tombstoneDiscussionComment.mockResolvedValue(tombstoned);
    db.findUserById.mockResolvedValue(sampleUserRecord);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'DELETE',
      url: '/discussion-comments/comment-1',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().tombstoned).toBe(true);
    expect(response.json().body).toBeNull();

    await app.close();
  });

  it('blocks unauthorized users from tombstoning comments they do not own', async () => {
    const db = createStubDatabase();
    db.findDiscussionCommentById.mockResolvedValue(
      sampleDiscussionComment({ authorUserId: 'other-user' })
    );
    db.findRequestById.mockResolvedValue(sampleRequest);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'DELETE',
      url: '/discussion-comments/comment-1',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(403);
    expect(db.tombstoneDiscussionComment).not.toHaveBeenCalled();

    await app.close();
  });

  it('omits avatar metadata when the author user record is missing', async () => {
    const db = createStubDatabase();
    const comment = sampleDiscussionComment({ authorUserId: 'missing-user' });
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.listDiscussionComments.mockResolvedValue({ comments: [comment], nextCursor: null });
    const app = await createProtectedTestApp({ db, withValidAuth: true });
    db.findUserById.mockImplementation(async (userId: string) =>
      userId === 'missing-user' ? null : sampleUserRecord
    );

    const response = await app.inject({
      method: 'GET',
      url: '/requests/request-1/discussions',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().comments[0].author).toEqual({
      id: 'missing-user',
      name: 'Unknown user'
    });

    await app.close();
  });

  it('preserves request.comment as a separate legacy notes field', () => {
    expect(sampleRequest.comment).toBe('Legacy note stays separate');
  });
});

describe('discussion routes in E2EE mode', () => {
  it('rejects plaintext create, reply, and update bodies', async () => {
    const db = createStubDatabase();
    const comment = sampleDiscussionComment();
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.findDiscussionCommentById.mockResolvedValue(comment);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/requests/request-1/discussions',
      headers: authHeader(),
      payload: { body: 'Plaintext should fail' }
    });
    expect(createResponse.statusCode).toBe(400);
    expect(createResponse.json().error).toContain('Encrypted payloads are required');

    const replyResponse = await app.inject({
      method: 'POST',
      url: '/discussion-comments/comment-1/replies',
      headers: authHeader(),
      payload: { body: 'Plaintext reply should fail' }
    });
    expect(replyResponse.statusCode).toBe(400);

    const updateResponse = await app.inject({
      method: 'PUT',
      url: '/discussion-comments/comment-1',
      headers: authHeader(),
      payload: { body: 'Plaintext update should fail' }
    });
    expect(updateResponse.statusCode).toBe(400);
    expect(db.createDiscussionComment).not.toHaveBeenCalled();
    expect(db.updateDiscussionComment).not.toHaveBeenCalled();

    await app.close();
  });

  it('hides plaintext discussion bodies from list responses on E2EE hubs', async () => {
    const db = createStubDatabase();
    const comment = sampleDiscussionComment({ body: 'Should not leak' });
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.listDiscussionComments.mockResolvedValue({ comments: [comment], nextCursor: null });
    db.findUserById.mockResolvedValue(sampleUserRecord);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/requests/request-1/discussions',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().comments[0].body).toBeNull();

    await app.close();
  });

  it('accepts encrypted create, reply, and update payloads from enrolled devices', async () => {
    const db = createStubDatabase();
    const comment = sampleDiscussionComment();
    const { encryptedPayload, fields } = sampleEncryptedPayloadInput();
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.findDiscussionCommentById.mockResolvedValue(comment);
    db.findActiveDeviceKeyByUserAndDeviceId.mockResolvedValue(sampleDeviceKey());
    db.createDiscussionComment.mockResolvedValue(
      sampleDiscussionComment({
        body: fields.body,
        bodyFormat: 'encrypted',
        bodyMetadata: fields.bodyMetadata
      })
    );
    db.updateDiscussionComment.mockResolvedValue(
      sampleDiscussionComment({
        body: fields.body,
        bodyFormat: 'encrypted',
        bodyMetadata: fields.bodyMetadata
      })
    );
    db.findUserById.mockResolvedValue(sampleUserRecord);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/requests/request-1/discussions',
      headers: authHeader(),
      payload: { encryptedPayload }
    });
    expect(createResponse.statusCode).toBe(200);
    expect(db.createDiscussionComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: fields.body,
        bodyFormat: 'encrypted',
        bodyMetadata: fields.bodyMetadata
      }),
      'user-1'
    );
    expect(createResponse.json().body).toBeNull();
    expect(createResponse.json().encryptedPayload.ciphertext).toBe(fields.body);

    const replyResponse = await app.inject({
      method: 'POST',
      url: '/discussion-comments/comment-1/replies',
      headers: authHeader(),
      payload: { encryptedPayload }
    });
    expect(replyResponse.statusCode).toBe(200);

    const updateResponse = await app.inject({
      method: 'PUT',
      url: '/discussion-comments/comment-1',
      headers: authHeader(),
      payload: { encryptedPayload }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(db.updateDiscussionComment).toHaveBeenCalledWith(
      'comment-1',
      expect.objectContaining({
        body: fields.body,
        bodyFormat: 'encrypted'
      }),
      'user-1'
    );

    await app.close();
  });

  it('rejects encrypted payloads from unenrolled devices', async () => {
    const db = createStubDatabase();
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.findActiveDeviceKeyByUserAndDeviceId.mockResolvedValue(null);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/requests/request-1/discussions',
      headers: authHeader(),
      payload: { encryptedPayload: sampleEncryptedPayloadInput().encryptedPayload }
    });

    expect(response.statusCode).toBe(403);
    expect(db.createDiscussionComment).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns encrypted payload metadata without plaintext bodies on E2EE hubs', async () => {
    const db = createStubDatabase();
    const { fields } = sampleEncryptedPayloadInput();
    const comment = sampleDiscussionComment({
      body: fields.body,
      bodyFormat: 'encrypted',
      bodyMetadata: fields.bodyMetadata
    });
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.listDiscussionComments.mockResolvedValue({ comments: [comment], nextCursor: null });
    db.findUserById.mockResolvedValue(sampleUserRecord);
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/requests/request-1/discussions',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().comments[0].body).toBeNull();
    expect(response.json().comments[0].bodyFormat).toBe('encrypted');
    expect(response.json().comments[0].encryptedPayload.mlsGroupId).toBe(
      'thread:request:request-1'
    );

    await app.close();
  });
});
