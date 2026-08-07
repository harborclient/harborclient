import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { buildDiscussionMlsGroupId } from '#/db/discussionEncryptedPayload.js';
import {
  authHeader,
  createProtectedTestApp,
  sampleUserRecord
} from '#/server/routes/test/createTestApp.js';

const sampleDeviceId = '550e8400-e29b-41d4-a716-446655440000';
const mlsGroupId = buildDiscussionMlsGroupId('request', 'request-1');

const sampleRequest = {
  id: 'request-1',
  collectionId: 'collection-1',
  name: 'Get users',
  protocol: 'http' as const,
  method: 'GET' as const,
  url: 'https://example.test/users',
  headers: [],
  params: [],
  comment: 'Legacy note stays separate'
};

describe('discussion MLS routes in E2EE mode', () => {
  it('stores and lists MLS commits for enrolled devices', async () => {
    const db = createStubDatabase();
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.findActiveDeviceKeyByUserAndDeviceId.mockResolvedValue({
      id: 'device-key-1',
      userId: sampleUserRecord.id,
      deviceId: sampleDeviceId,
      label: 'Test device',
      keyFormat: 'identity-v1',
      publicKeyMaterial: 'dGVzdA==',
      fingerprint: 'abc',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      lastSeenAt: null,
      revokedAt: null,
      createdByUserId: sampleUserRecord.id,
      updatedByUserId: sampleUserRecord.id
    });
    db.listDiscussionMlsCommits.mockResolvedValue({
      commits: [
        {
          id: 'commit-1',
          mlsGroupId,
          epoch: 1,
          ciphertext: 'dGVzdC1jb21taXQ=',
          senderDeviceId: sampleDeviceId,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          createdByUserId: sampleUserRecord.id
        }
      ],
      nextCursor: undefined
    });
    db.upsertDiscussionMlsGroupState.mockResolvedValue({
      mlsGroupId,
      targetEntityType: 'request',
      targetEntityId: 'request-1',
      currentEpoch: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdByUserId: sampleUserRecord.id,
      updatedByUserId: sampleUserRecord.id
    });
    db.createDiscussionMlsCommit.mockImplementation(async (record) => record);

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/discussion-mls/commits',
      headers: authHeader(),
      payload: {
        mlsGroupId,
        epoch: 1,
        ciphertext: 'dGVzdC1jb21taXQ=',
        senderDeviceId: sampleDeviceId
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(db.createDiscussionMlsCommit).toHaveBeenCalled();
    expect(db.upsertDiscussionMlsGroupState).toHaveBeenCalledWith(
      { mlsGroupId, currentEpoch: 1 },
      'user-1'
    );

    const listResponse = await app.inject({
      method: 'GET',
      url: `/discussion-mls/commits?mlsGroupId=${encodeURIComponent(mlsGroupId)}`,
      headers: authHeader()
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().commits).toHaveLength(1);

    await app.close();
  });

  it('stores and lists MLS welcomes for accessible discussion threads', async () => {
    const db = createStubDatabase();
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.createDiscussionMlsWelcome.mockImplementation(async (record) => record);
    db.listDiscussionMlsWelcomes.mockResolvedValue({
      welcomes: [
        {
          id: 'welcome-1',
          mlsGroupId,
          recipientDeviceId: sampleDeviceId,
          ciphertext: 'd2VsY29tZQ==',
          ratchetTree: 'dHJlZQ==',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          createdByUserId: sampleUserRecord.id
        }
      ]
    });

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/discussion-mls/welcomes',
      headers: authHeader(),
      payload: {
        mlsGroupId,
        recipientDeviceId: sampleDeviceId,
        ciphertext: 'd2VsY29tZQ==',
        ratchetTree: 'dHJlZQ=='
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(db.createDiscussionMlsWelcome).toHaveBeenCalled();

    const listResponse = await app.inject({
      method: 'GET',
      url: `/discussion-mls/welcomes?mlsGroupId=${encodeURIComponent(mlsGroupId)}&recipientDeviceId=${sampleDeviceId}`,
      headers: authHeader()
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().welcomes).toHaveLength(1);

    await app.close();
  });

  it('returns MLS group state for initialized threads', async () => {
    const db = createStubDatabase();
    db.findRequestById.mockResolvedValue(sampleRequest);
    db.getDiscussionMlsGroupState.mockResolvedValue({
      mlsGroupId,
      targetEntityType: 'request',
      targetEntityId: 'request-1',
      currentEpoch: 2,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdByUserId: sampleUserRecord.id,
      updatedByUserId: sampleUserRecord.id
    });

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      collaboration: { e2ee: true }
    });

    const response = await app.inject({
      method: 'GET',
      url: `/discussion-mls/group-state/${encodeURIComponent(mlsGroupId)}`,
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().currentEpoch).toBe(2);

    await app.close();
  });
});
