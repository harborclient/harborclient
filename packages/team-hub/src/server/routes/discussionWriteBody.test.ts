import { describe, expect, it, vi } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { DeviceKeyRecord } from '#/db/types.js';
import { hashDeviceKeyFingerprint } from '#/db/deviceKeyLogic.js';
import { buildEncryptedDiscussionCommentFields } from '#/db/discussionEncryptedPayload.js';
import { parseDiscussionWriteBody } from '#/server/routes/discussionWriteBody.js';
import { sampleUserRecord } from '#/server/routes/test/createTestApp.js';

const sampleDeviceId = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Builds a device key fixture for write-body tests.
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

describe('parseDiscussionWriteBody', () => {
  it('accepts encrypted payloads on E2EE hubs for enrolled devices', async () => {
    const db = createStubDatabase();
    db.findActiveDeviceKeyByUserAndDeviceId.mockResolvedValue(sampleDeviceKey());
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    const encryptedPayload = buildEncryptedDiscussionCommentFields({
      ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
      mlsGroupId: 'thread:request:request-1',
      epoch: 0,
      senderDeviceId: sampleDeviceId,
      keyFormat: 'identity-v1'
    });

    const parsed = await parseDiscussionWriteBody(
      reply as never,
      { e2ee: true },
      db,
      sampleUserRecord,
      {
        encryptedPayload: {
          ciphertext: encryptedPayload.body,
          mlsGroupId: 'thread:request:request-1',
          epoch: 0,
          senderDeviceId: sampleDeviceId,
          keyFormat: 'identity-v1'
        }
      }
    );

    expect(parsed).toEqual({
      body: encryptedPayload.body,
      bodyFormat: 'encrypted',
      bodyMetadata: encryptedPayload.bodyMetadata
    });
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('rejects encrypted payloads from unenrolled devices', async () => {
    const db = createStubDatabase();
    db.findActiveDeviceKeyByUserAndDeviceId.mockResolvedValue(null);
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };

    const parsed = await parseDiscussionWriteBody(
      reply as never,
      { e2ee: true },
      db,
      sampleUserRecord,
      {
        encryptedPayload: {
          ciphertext: 'dGVzdA==',
          mlsGroupId: 'thread:request:request-1',
          epoch: 0,
          senderDeviceId: sampleDeviceId,
          keyFormat: 'identity-v1'
        }
      }
    );

    expect(parsed).toBeNull();
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('accepts plaintext bodies on non-E2EE hubs', async () => {
    const db = createStubDatabase();
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };

    const parsed = await parseDiscussionWriteBody(
      reply as never,
      { e2ee: false },
      db,
      sampleUserRecord,
      { body: ' Plaintext note ' }
    );

    expect(parsed).toEqual({
      body: 'Plaintext note',
      bodyFormat: 'plaintext',
      bodyMetadata: null
    });
  });
});
