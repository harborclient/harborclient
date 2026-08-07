import { describe, expect, it } from 'vitest';
import { resolveDiscussionMode } from './resolveDiscussionMode';

describe('resolveDiscussionMode', () => {
  it('falls back to legacy notes for local collections', () => {
    expect(
      resolveDiscussionMode({
        connectionId: 'sqlite-local',
        entityUuid: 'req-1',
        isTeamHubConnection: false,
        hubConnected: true,
        communicationServiceEnabled: true,
        communicationAccess: true
      })
    ).toBe('legacy-notes');
  });

  it('uses threaded mode when all Team Hub communication prerequisites are met', () => {
    expect(
      resolveDiscussionMode({
        connectionId: 'hub-1',
        entityUuid: 'req-1',
        isTeamHubConnection: true,
        hubConnected: true,
        communicationServiceEnabled: true,
        communicationAccess: true
      })
    ).toBe('threaded');
  });

  it('falls back when communication is disabled on the hub or token', () => {
    expect(
      resolveDiscussionMode({
        connectionId: 'hub-1',
        entityUuid: 'req-1',
        isTeamHubConnection: true,
        hubConnected: true,
        communicationServiceEnabled: false,
        communicationAccess: true
      })
    ).toBe('legacy-notes');

    expect(
      resolveDiscussionMode({
        connectionId: 'hub-1',
        entityUuid: 'req-1',
        isTeamHubConnection: true,
        hubConnected: true,
        communicationServiceEnabled: true,
        communicationAccess: false
      })
    ).toBe('legacy-notes');
  });
});
