import { describe, expect, it } from 'vitest';
import { buildPluginInstallDeepLink, parseHarborDeepLink } from '#/shared/deepLink';

describe('parseHarborDeepLink', () => {
  it('parses a valid plugin install URL', () => {
    expect(
      parseHarborDeepLink('harborclient://plugin/install?id=com.harborclient.plugins.curl')
    ).toEqual({
      action: 'install-plugin',
      pluginId: 'com.harborclient.plugins.curl'
    });
  });

  it('returns null for the wrong protocol', () => {
    expect(
      parseHarborDeepLink('https://harborclient.com/plugin/install?id=com.example.plugin')
    ).toBeNull();
  });

  it('returns null when the plugin id is missing', () => {
    expect(parseHarborDeepLink('harborclient://plugin/install')).toBeNull();
  });

  it('returns null when the plugin id is invalid', () => {
    expect(parseHarborDeepLink('harborclient://plugin/install?id=not-valid')).toBeNull();
  });

  it('returns null for an unsupported path', () => {
    expect(
      parseHarborDeepLink('harborclient://plugin/update?id=com.harborclient.plugins.curl')
    ).toBeNull();
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
