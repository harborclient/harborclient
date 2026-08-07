import { describe, expect, it } from 'vitest';
import type { TeamHubNotice } from '@harborclient/core/types';
import {
  formatTeamHubNoticeMessage,
  formatTeamHubNoticeTargetLabel
} from './formatTeamHubNoticeMessage';

/**
 * Builds a minimal notice fixture for formatting tests.
 *
 * @param overrides - Partial notice fields to override defaults.
 */
function sampleNotice(overrides: Partial<TeamHubNotice> = {}): TeamHubNotice {
  return {
    id: 'notice-1',
    eventType: 'discussion.mention',
    entityType: 'request',
    entityId: 'request-1',
    requestId: 'request-1',
    collectionId: 'collection-1',
    folderId: null,
    runResultId: null,
    discussionThreadId: 'comment-root',
    discussionCommentId: 'comment-2',
    actor: {
      id: 'user-2',
      name: 'Peer',
      avatar: { initials: 'PE', color: 'rose-600' }
    },
    createdAt: '2026-01-02T00:00:00.000Z',
    readAt: null,
    displayMetadata: {
      actorName: 'Peer',
      targetLabel: 'Get users',
      method: 'GET',
      requestName: 'Get users',
      previewText: 'Ping @you'
    },
    ...overrides
  };
}

describe('formatTeamHubNoticeMessage', () => {
  it('formats request update notices', () => {
    const notice = sampleNotice({
      eventType: 'request.updated',
      displayMetadata: {
        actorName: 'Peer',
        targetLabel: 'Get users',
        method: 'GET',
        requestName: 'Get users'
      }
    });

    expect(formatTeamHubNoticeMessage(notice)).toBe('Peer updated Get users');
  });

  it('includes preview text for discussion notices', () => {
    expect(formatTeamHubNoticeMessage(sampleNotice())).toBe(
      'Peer mentioned you on Get users: Ping @you'
    );
  });

  it('formats run result notices with run labels', () => {
    const notice = sampleNotice({
      eventType: 'runResult.created',
      entityType: 'runResult',
      displayMetadata: {
        actorName: 'Peer',
        targetLabel: 'Smoke run',
        runLabel: 'Smoke run'
      }
    });

    expect(formatTeamHubNoticeMessage(notice)).toBe('Peer saved run Smoke run');
  });
});

describe('formatTeamHubNoticeTargetLabel', () => {
  it('returns denormalized target label metadata', () => {
    expect(formatTeamHubNoticeTargetLabel(sampleNotice())).toBe('Get users');
  });
});
