import { describe, expect, it } from 'vitest';
import type { TeamHub } from '@harborclient/core/types';
import {
  isSoftDisconnectedTeamHubCollection,
  isTeamHubCollectionConnection,
  isUnavailableTeamHubCollection
} from './teamHubCollectionAvailability';

const JOE_HUB: TeamHub = {
  id: 'hub-joe',
  name: 'Joe',
  baseUrl: 'https://joe.example',
  token: 'token',
  connected: false
};

const DEV_HUB: TeamHub = {
  id: 'hub-dev',
  name: 'Dev',
  baseUrl: 'https://dev.example',
  token: 'token',
  connected: true
};

describe('teamHubCollectionAvailability', () => {
  it('identifies team hub collection connections', () => {
    expect(isTeamHubCollectionConnection('hub-joe', [JOE_HUB, DEV_HUB])).toBe(true);
    expect(isTeamHubCollectionConnection('sqlite-a', [JOE_HUB, DEV_HUB])).toBe(false);
  });

  it('treats soft-disconnected hubs as unavailable', () => {
    expect(isUnavailableTeamHubCollection('hub-joe', [JOE_HUB, DEV_HUB], { 'hub-dev': true })).toBe(
      true
    );
  });

  it('treats connected but offline hubs as unavailable', () => {
    expect(
      isUnavailableTeamHubCollection('hub-dev', [JOE_HUB, DEV_HUB], { 'hub-dev': false })
    ).toBe(true);
  });

  it('treats connected and online hubs as available', () => {
    expect(isUnavailableTeamHubCollection('hub-dev', [JOE_HUB, DEV_HUB], { 'hub-dev': true })).toBe(
      false
    );
  });

  it('detects soft-disconnect for connect prompts', () => {
    expect(isSoftDisconnectedTeamHubCollection('hub-joe', [JOE_HUB, DEV_HUB])).toBe(true);
    expect(isSoftDisconnectedTeamHubCollection('hub-dev', [JOE_HUB, DEV_HUB])).toBe(false);
  });
});
