import { describe, expect, it } from 'vitest';
import {
  buildPluginInstallDeepLink,
  buildRunResultsDeepLink,
  buildSnippetInstallDeepLink,
  buildTeamHubJoinDeepLink,
  buildTeamHubJoinUrl,
  buildThemeInstallDeepLink,
  parseHarborDeepLink,
  parseTeamHubInviteLink
} from '#/shared/deepLink';

const sampleInviteParams = {
  baseUrl: 'https://teamhub.example.com',
  code: 'hbi_testinvitationcode1234567890',
  name: 'Alice',
  role: 'user' as const,
  expiresAt: '2099-01-01T00:00:00.000Z',
  hubName: 'Acme Team Hub',
  accessSummary: 'Collections: all'
};

describe('parseHarborDeepLink', () => {
  it('parses a valid plugin install URL', () => {
    expect(
      parseHarborDeepLink('harborclient://plugin/install?id=com.harborclient.plugins.curl')
    ).toEqual({
      action: 'install-plugin',
      pluginId: 'com.harborclient.plugins.curl'
    });
  });

  it('parses a valid theme install URL', () => {
    expect(
      parseHarborDeepLink(
        'harborclient://theme/install?id=com.harborclient.plugins.catppuccin-latte'
      )
    ).toEqual({
      action: 'install-theme',
      pluginId: 'com.harborclient.plugins.catppuccin-latte'
    });
  });

  it('parses a valid snippet install URL', () => {
    expect(
      parseHarborDeepLink('harborclient://snippet/install?id=com.harborclient.snippets.testing')
    ).toEqual({
      action: 'install-snippet',
      pluginId: 'com.harborclient.snippets.testing'
    });
  });

  it('parses a valid run results open URL', () => {
    expect(parseHarborDeepLink('harborclient://run/550e8400-e29b-41d4-a716-446655440000')).toEqual({
      action: 'open-run-results',
      uuid: '550e8400-e29b-41d4-a716-446655440000'
    });
  });

  it('parses a valid Team Hub join URL with display metadata', () => {
    expect(parseHarborDeepLink(buildTeamHubJoinDeepLink(sampleInviteParams))).toEqual({
      action: 'join-team-hub',
      ...sampleInviteParams
    });
  });

  it('parses a legacy Team Hub join URL with only url and code', () => {
    expect(
      parseHarborDeepLink(
        'harborclient://team-hub/join?url=http%3A%2F%2F127.0.0.1%3A8788&code=hbi_testinvitationcode1234567890'
      )
    ).toEqual({
      action: 'join-team-hub',
      baseUrl: 'http://127.0.0.1:8788',
      code: 'hbi_testinvitationcode1234567890'
    });
  });

  it('returns null for invalid Team Hub join URLs', () => {
    expect(parseHarborDeepLink('harborclient://team-hub/join')).toBeNull();
    expect(
      parseHarborDeepLink(
        'harborclient://team-hub/join?url=ftp://example.com&code=hbi_abc123456789012345678'
      )
    ).toBeNull();
    expect(
      parseHarborDeepLink('harborclient://team-hub/join?url=http://127.0.0.1:8788&code=not-valid')
    ).toBeNull();
  });

  it('returns null for the wrong protocol', () => {
    expect(
      parseHarborDeepLink('https://harborclient.com/plugin/install?id=com.example.plugin')
    ).toBeNull();
  });

  it('returns null when the plugin id is missing', () => {
    expect(parseHarborDeepLink('harborclient://plugin/install')).toBeNull();
    expect(parseHarborDeepLink('harborclient://theme/install')).toBeNull();
    expect(parseHarborDeepLink('harborclient://snippet/install')).toBeNull();
  });

  it('returns null when the plugin id is invalid', () => {
    expect(parseHarborDeepLink('harborclient://plugin/install?id=not-valid')).toBeNull();
    expect(parseHarborDeepLink('harborclient://theme/install?id=not-valid')).toBeNull();
    expect(parseHarborDeepLink('harborclient://snippet/install?id=not-valid')).toBeNull();
  });

  it('returns null for an unsupported path', () => {
    expect(
      parseHarborDeepLink('harborclient://plugin/update?id=com.harborclient.plugins.curl')
    ).toBeNull();
    expect(
      parseHarborDeepLink('harborclient://theme/update?id=com.harborclient.plugins.dracula')
    ).toBeNull();
    expect(parseHarborDeepLink('harborclient://run/not-a-uuid')).toBeNull();
  });
});

describe('parseTeamHubInviteLink', () => {
  it('parses an HTTPS join link with the secret in the fragment', () => {
    const url = buildTeamHubJoinUrl(sampleInviteParams);
    expect(parseTeamHubInviteLink(url)).toEqual({
      action: 'join-team-hub',
      ...sampleInviteParams
    });
  });

  it('parses harborclient:// join links for backward compatibility', () => {
    const url = buildTeamHubJoinDeepLink(sampleInviteParams);
    expect(parseTeamHubInviteLink(url)).toEqual({
      action: 'join-team-hub',
      ...sampleInviteParams
    });
  });
});

describe('buildPluginInstallDeepLink', () => {
  it('builds an install URL that round-trips through the parser', () => {
    const url = buildPluginInstallDeepLink('com.harborclient.plugins.curl');
    expect(parseHarborDeepLink(url)).toEqual({
      action: 'install-plugin',
      pluginId: 'com.harborclient.plugins.curl'
    });
  });
});

describe('buildThemeInstallDeepLink', () => {
  it('builds a theme install URL that round-trips through the parser', () => {
    const url = buildThemeInstallDeepLink('com.harborclient.plugins.dracula');
    expect(parseHarborDeepLink(url)).toEqual({
      action: 'install-theme',
      pluginId: 'com.harborclient.plugins.dracula'
    });
  });
});

describe('buildSnippetInstallDeepLink', () => {
  it('builds a snippet install URL that round-trips through the parser', () => {
    const url = buildSnippetInstallDeepLink('com.harborclient.snippets.testing');
    expect(parseHarborDeepLink(url)).toEqual({
      action: 'install-snippet',
      pluginId: 'com.harborclient.snippets.testing'
    });
  });
});

describe('buildRunResultsDeepLink', () => {
  it('builds a run results URL that round-trips through the parser', () => {
    const url = buildRunResultsDeepLink('550e8400-e29b-41d4-a716-446655440000');
    expect(parseHarborDeepLink(url)).toEqual({
      action: 'open-run-results',
      uuid: '550e8400-e29b-41d4-a716-446655440000'
    });
  });
});

describe('buildTeamHubJoinUrl', () => {
  it('builds an HTTPS join URL that round-trips through parseTeamHubInviteLink', () => {
    const url = buildTeamHubJoinUrl(sampleInviteParams);
    expect(parseTeamHubInviteLink(url)).toEqual({
      action: 'join-team-hub',
      ...sampleInviteParams
    });
  });
});
