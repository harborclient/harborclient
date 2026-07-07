import { describe, expect, it } from 'vitest';
import {
  buildPluginInstallDeepLink,
  buildSnippetInstallDeepLink,
  buildThemeInstallDeepLink,
  parseHarborDeepLink
} from '#/shared/deepLink';

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
