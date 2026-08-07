import { describe, expect, it } from 'vitest';
import {
  buildDiscussionMlsCommitListResult,
  buildDiscussionMlsCommitRecord,
  buildDiscussionMlsGroupStateRecord,
  buildDiscussionMlsWelcomeRecord,
  parseDiscussionMlsCommitListCursor,
  parseDiscussionMlsGroupId,
  validateCreateDiscussionMlsCommitInput,
  validateCreateDiscussionMlsWelcomeInput
} from '#/db/discussionMlsLogic.js';

const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000';
const DEVICE_ID = '6ba7b811-9dad-41d4-a716-446655440000';
const MLS_GROUP_ID = `thread:request:${REQUEST_ID}`;

describe('discussionMlsLogic', () => {
  it('parses canonical MLS group ids', () => {
    expect(parseDiscussionMlsGroupId(MLS_GROUP_ID)).toEqual({
      targetEntityType: 'request',
      targetEntityId: REQUEST_ID
    });
    expect(parseDiscussionMlsGroupId('invalid')).toBeNull();
  });

  it('builds MLS commit records from validated input', () => {
    const record = buildDiscussionMlsCommitRecord(
      {
        mlsGroupId: MLS_GROUP_ID,
        epoch: 2,
        ciphertext: 'dGVzdC1jb21taXQ=',
        senderDeviceId: DEVICE_ID
      },
      'user-1'
    );

    expect(record.mlsGroupId).toBe(MLS_GROUP_ID);
    expect(record.epoch).toBe(2);
    expect(record.createdByUserId).toBe('user-1');
  });

  it('builds MLS welcome records from validated input', () => {
    const record = buildDiscussionMlsWelcomeRecord(
      {
        mlsGroupId: MLS_GROUP_ID,
        recipientDeviceId: DEVICE_ID,
        ciphertext: 'd2VsY29tZQ==',
        ratchetTree: 'dHJlZQ=='
      },
      'user-1'
    );

    expect(record.recipientDeviceId).toBe(DEVICE_ID);
    expect(record.createdByUserId).toBe('user-1');
  });

  it('builds MLS group state records from validated input', () => {
    const record = buildDiscussionMlsGroupStateRecord(
      {
        mlsGroupId: MLS_GROUP_ID,
        currentEpoch: 3
      },
      'user-1'
    );

    expect(record.targetEntityType).toBe('request');
    expect(record.targetEntityId).toBe(REQUEST_ID);
    expect(record.currentEpoch).toBe(3);
  });

  it('rejects invalid MLS commit input', () => {
    expect(() =>
      validateCreateDiscussionMlsCommitInput({
        mlsGroupId: 'bad-group',
        epoch: -1,
        ciphertext: '',
        senderDeviceId: 'not-a-uuid'
      })
    ).toThrow(/MLS group id/);
  });

  it('rejects invalid MLS welcome input', () => {
    expect(() =>
      validateCreateDiscussionMlsWelcomeInput({
        mlsGroupId: MLS_GROUP_ID,
        recipientDeviceId: 'not-a-uuid',
        ciphertext: 'd2VsY29tZQ==',
        ratchetTree: 'dHJlZQ=='
      })
    ).toThrow(/Recipient device id/);
  });

  it('parses commit list cursors and builds paginated results', () => {
    expect(parseDiscussionMlsCommitListCursor('5')).toBe(5);
    expect(parseDiscussionMlsCommitListCursor(undefined)).toBeNull();

    expect(() => parseDiscussionMlsCommitListCursor('abc')).toThrow(/non-negative integer/);

    const page = buildDiscussionMlsCommitListResult(
      [
        {
          id: 'commit-1',
          mlsGroupId: MLS_GROUP_ID,
          epoch: 1,
          ciphertext: 'a',
          senderDeviceId: DEVICE_ID,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          createdByUserId: 'user-1'
        },
        {
          id: 'commit-2',
          mlsGroupId: MLS_GROUP_ID,
          epoch: 2,
          ciphertext: 'b',
          senderDeviceId: DEVICE_ID,
          createdAt: new Date('2026-01-01T00:00:01.000Z'),
          createdByUserId: 'user-1'
        }
      ],
      1
    );

    expect(page.commits).toHaveLength(1);
    expect(page.nextCursor).toBe('1');
  });
});
