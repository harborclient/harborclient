import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildDiscussionMlsGroupId,
  buildEncryptedDiscussionPayload,
  decryptDiscussionBodyIdentityV1,
  decryptDiscussionCommentBody,
  encryptDiscussionBodyIdentityV1
} from './teamHubDiscussionCrypto';

const deviceId = '550e8400-e29b-41d4-a716-446655440000';
const mlsGroupId = buildDiscussionMlsGroupId('request', 'request-1');

/**
 * Builds PKCS8 private key material for crypto tests.
 */
function samplePrivateKeyMaterial(): string {
  const { privateKey } = generateKeyPairSync('ed25519');
  return privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
}

describe('teamHubDiscussionCrypto', () => {
  it('round-trips identity-v1 discussion bodies', () => {
    const privateKeyMaterial = samplePrivateKeyMaterial();
    const encoded = encryptDiscussionBodyIdentityV1(
      'Secret thread note',
      privateKeyMaterial,
      mlsGroupId
    );
    expect(decryptDiscussionBodyIdentityV1(encoded, privateKeyMaterial, mlsGroupId)).toBe(
      'Secret thread note'
    );
  });

  it('builds encrypted payloads with canonical MLS group ids', () => {
    const privateKeyMaterial = samplePrivateKeyMaterial();
    const payload = buildEncryptedDiscussionPayload(
      'Encrypted comment',
      privateKeyMaterial,
      deviceId,
      mlsGroupId
    );

    expect(payload.keyFormat).toBe('identity-v1');
    expect(payload.senderDeviceId).toBe(deviceId);
    expect(payload.mlsGroupId).toBe('thread:request:request-1');
  });

  it('decrypts encrypted discussion comments for renderer display', () => {
    const privateKeyMaterial = samplePrivateKeyMaterial();
    const payload = buildEncryptedDiscussionPayload(
      'Visible after decrypt',
      privateKeyMaterial,
      deviceId,
      mlsGroupId
    );

    const decrypted = decryptDiscussionCommentBody(
      {
        id: 'comment-1',
        entityType: 'request',
        entityId: 'request-1',
        parentCommentId: null,
        rootCommentId: 'comment-1',
        depth: 1,
        body: null,
        bodyFormat: 'encrypted',
        encryptedPayload: payload,
        author: { id: 'user-1', name: 'Alice' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        tombstoned: false
      },
      privateKeyMaterial
    );

    expect(decrypted.body).toBe('Visible after decrypt');
  });
});
