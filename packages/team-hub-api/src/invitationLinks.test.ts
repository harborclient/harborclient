import { describe, expect, it } from 'vitest';
import {
  buildTeamHubJoinDeepLink,
  buildTeamHubJoinUrl,
  parseTeamHubJoinDeepLink,
  parseTeamHubJoinUrl
} from './invitationLinks.js';

const sampleParams = {
  baseUrl: 'https://teamhub.harborclient.com',
  code: 'hbi_testinvitationcode1234567890',
  name: 'Alice',
  role: 'user' as const,
  expiresAt: '2099-01-01T00:00:00.000Z',
  hubName: 'Acme Team Hub',
  accessSummary: 'Collections: all · Environments: all'
};

describe('buildTeamHubJoinUrl', () => {
  it('places display info in the query and the secret in the fragment', () => {
    const url = buildTeamHubJoinUrl(sampleParams);
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://teamhub.harborclient.com/join');
    expect(parsed.searchParams.get('url')).toBe('https://teamhub.harborclient.com');
    expect(parsed.searchParams.get('name')).toBe('Alice');
    expect(parsed.searchParams.get('role')).toBe('user');
    expect(parsed.searchParams.get('exp')).toBe('2099-01-01T00:00:00.000Z');
    expect(parsed.searchParams.get('hub')).toBe('Acme Team Hub');
    expect(parsed.searchParams.get('access')).toBe('Collections: all · Environments: all');
    expect(parsed.searchParams.get('code')).toBeNull();
    expect(new URLSearchParams(parsed.hash.slice(1)).get('code')).toBe(sampleParams.code);
  });
});

describe('parseTeamHubJoinUrl', () => {
  it('round-trips invitation parameters from an HTTPS join link', () => {
    const url = buildTeamHubJoinUrl(sampleParams);
    expect(parseTeamHubJoinUrl(url)).toEqual(sampleParams);
  });

  it('rejects links with the secret in the query string', () => {
    const url =
      'https://teamhub.harborclient.com/join?url=https%3A%2F%2Fteamhub.harborclient.com&name=Alice&role=user&exp=2099-01-01T00%3A00%3A00.000Z&code=hbi_testinvitationcode1234567890';
    expect(parseTeamHubJoinUrl(url)).toBeNull();
  });

  it('rejects permanent API tokens', () => {
    const url = buildTeamHubJoinUrl({
      ...sampleParams,
      code: 'hbk_permanenttoken1234567890'
    });
    expect(parseTeamHubJoinUrl(url)).toBeNull();
  });
});

describe('buildTeamHubJoinDeepLink', () => {
  it('includes the secret in the query string', () => {
    const url = buildTeamHubJoinDeepLink(sampleParams);
    expect(url.startsWith('harborclient://team-hub/join?')).toBe(true);
    expect(parseTeamHubJoinDeepLink(url)).toEqual(sampleParams);
  });
});

describe('parseTeamHubJoinDeepLink', () => {
  it('rejects invalid scheme hosts', () => {
    expect(parseTeamHubJoinDeepLink('https://teamhub.harborclient.com/join')).toBeNull();
  });
});
