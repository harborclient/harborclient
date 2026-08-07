import { describe, expect, it } from 'vitest';
import { parseNoticeStreamEvent } from './readNoticeStream.js';

describe('parseNoticeStreamEvent', () => {
  it('parses notice.created payloads', () => {
    expect(
      parseNoticeStreamEvent(
        JSON.stringify({
          v: 1,
          type: 'notice.created',
          noticeId: 'notice-1',
          unreadCount: 4
        })
      )
    ).toEqual({
      v: 1,
      type: 'notice.created',
      noticeId: 'notice-1',
      unreadCount: 4
    });
  });

  it('returns null for unrelated payloads', () => {
    expect(parseNoticeStreamEvent(JSON.stringify({ type: 'other' }))).toBeNull();
  });
});
