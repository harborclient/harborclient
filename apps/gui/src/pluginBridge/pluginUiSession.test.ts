import { describe, expect, it } from 'vitest';
import {
  buildPluginAgentUrl,
  buildPluginSurfaceUrl
} from '@harborclient/core/plugin/pluginSurface';
import {
  derivePluginWebviewSession,
  parsePluginWebviewSessionFromUrl,
  pluginSessionPartition
} from './pluginUiSession';
import { parseContributionMessage, parsePluginUiBridgePayload } from './pluginUiBridgeSchemas';

describe('parsePluginWebviewSessionFromUrl', () => {
  it('derives agent identity from the harbor-plugin agent URL', () => {
    expect(parsePluginWebviewSessionFromUrl(buildPluginAgentUrl('com.example.plugin'))).toEqual({
      pluginId: 'com.example.plugin',
      role: 'agent'
    });
  });

  it('derives view identity including contribution metadata', () => {
    expect(
      parsePluginWebviewSessionFromUrl(
        buildPluginSurfaceUrl('com.example.plugin', 'panel', 'sidebarPanels', 'headerActions')
      )
    ).toEqual({
      pluginId: 'com.example.plugin',
      role: 'view',
      contributionId: 'panel',
      kind: 'sidebarPanels',
      slot: 'headerActions'
    });
  });

  it('rejects non-plugin protocols', () => {
    expect(() => parsePluginWebviewSessionFromUrl('https://evil.example/')).toThrow(
      /harbor-plugin/
    );
  });
});

describe('derivePluginWebviewSession', () => {
  it('rejects a partition that does not match the URL plugin id', () => {
    expect(() =>
      derivePluginWebviewSession({
        getURL: () => buildPluginAgentUrl('com.example.plugin'),
        session: { partition: pluginSessionPartition('com.other.plugin') }
      })
    ).toThrow(/partition mismatch/);
  });

  it('accepts a matching partition', () => {
    expect(
      derivePluginWebviewSession({
        getURL: () => buildPluginAgentUrl('com.example.plugin'),
        session: { partition: pluginSessionPartition('com.example.plugin') }
      }).pluginId
    ).toBe('com.example.plugin');
  });
});

describe('parsePluginUiBridgePayload', () => {
  it('validates storage.get payloads', () => {
    expect(parsePluginUiBridgePayload('storage.get', { key: 'token' })).toEqual({ key: 'token' });
    expect(() => parsePluginUiBridgePayload('storage.get', { key: '' })).toThrow(/storage\.get/);
  });

  it('rejects unknown operations', () => {
    expect(() => parsePluginUiBridgePayload('not.a.real.op', {})).toThrow(/Unsupported/);
  });
});

describe('parseContributionMessage', () => {
  it('validates theme contributions before registration', () => {
    expect(
      parseContributionMessage({
        pluginId: 'com.example.theme',
        op: 'registerContribution',
        kind: 'themes',
        contribution: {
          id: 'latte',
          title: 'Latte',
          type: 'light',
          colors: { surface: '#eff1f5' }
        }
      })
    ).toMatchObject({
      kind: 'themes',
      contribution: { id: 'latte', type: 'light' }
    });
  });

  it('rejects theme contributions with invalid type', () => {
    expect(() =>
      parseContributionMessage({
        pluginId: 'com.example.theme',
        op: 'registerContribution',
        kind: 'themes',
        contribution: {
          id: 'latte',
          title: 'Latte',
          type: 'sepia'
        }
      })
    ).toThrow(/themes/);
  });
});
