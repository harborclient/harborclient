import { describe, expect, it } from 'vitest';
import {
  buildDiscussionMlsGroupId,
  buildEncryptedDiscussionCommentFields,
  parseDiscussionEncryptedBodyMetadata,
  validateDiscussionEncryptedPayloadInput
} from '#/db/discussionEncryptedPayload.js';

const samplePayload = {
  ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
  mlsGroupId: 'thread:request:request-1',
  epoch: 0,
  senderDeviceId: '550e8400-e29b-41d4-a716-446655440000',
  keyFormat: 'identity-v1' as const
};

describe('discussionEncryptedPayload', () => {
  it('builds canonical MLS group ids per entity thread', () => {
    expect(buildDiscussionMlsGroupId('request', 'request-1')).toBe('thread:request:request-1');
  });

  it('builds encrypted comment fields from validated payload input', () => {
    const fields = buildEncryptedDiscussionCommentFields(samplePayload);
    expect(fields.bodyFormat).toBe('encrypted');
    expect(fields.body).toBe(samplePayload.ciphertext);
    expect(fields.bodyMetadata.senderDeviceId).toBe(samplePayload.senderDeviceId);
  });

  it('parses encrypted metadata from persisted JSON', () => {
    const metadata = parseDiscussionEncryptedBodyMetadata({
      version: 1,
      mlsGroupId: 'thread:request:request-1',
      epoch: 2,
      senderDeviceId: samplePayload.senderDeviceId,
      keyFormat: 'identity-v1'
    });

    expect(metadata?.epoch).toBe(2);
  });

  it('rejects invalid encrypted payload input', () => {
    expect(() =>
      validateDiscussionEncryptedPayloadInput({
        ...samplePayload,
        senderDeviceId: 'not-a-uuid'
      })
    ).toThrow(/UUID v4/);
  });
});
