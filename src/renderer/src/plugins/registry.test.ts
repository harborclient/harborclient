import { describe, expect, it } from 'vitest';
import {
  clearPluginContributions,
  getRegisteredPluginThemes,
  getRegisteredRequestTabs,
  getRegisteredSettingsSections,
  registerRequestTabContribution,
  registerSettingsSectionContribution,
  registerThemeContribution,
  unregisterContribution
} from './registry';

describe('plugin registry', () => {
  it('returns stable snapshot references until contributions change', () => {
    const first = getRegisteredSettingsSections();
    const second = getRegisteredSettingsSections();
    expect(second).toBe(first);

    const disposable = registerSettingsSectionContribution('com.example.test', {
      id: 'plugin:com.example.test:general',
      title: 'Example',
      contributionId: 'general'
    });

    const third = getRegisteredSettingsSections();
    expect(third).not.toBe(first);
    expect(third).toHaveLength(1);

    const fourth = getRegisteredSettingsSections();
    expect(fourth).toBe(third);

    disposable.dispose();
    expect(getRegisteredSettingsSections()).not.toBe(third);
    expect(getRegisteredPluginThemes()).toBe(getRegisteredPluginThemes());
  });

  it('keeps stable references for request tab snapshots', () => {
    const first = getRegisteredRequestTabs();
    const second = getRegisteredRequestTabs();
    expect(second).toBe(first);

    const disposable = registerRequestTabContribution('com.example.test', {
      id: 'plugin:com.example.test:tab',
      title: 'Tab',
      contributionId: 'tab'
    });

    const third = getRegisteredRequestTabs();
    expect(third).not.toBe(first);
    expect(third).toHaveLength(1);

    disposable.dispose();
    expect(getRegisteredRequestTabs()).not.toBe(third);
  });

  it('clearPluginContributions removes one plugin from every bucket', () => {
    registerSettingsSectionContribution('com.example.a', {
      id: 'plugin:com.example.a:general',
      title: 'A Settings',
      contributionId: 'general'
    });
    registerRequestTabContribution('com.example.a', {
      id: 'plugin:com.example.a:tab',
      title: 'A Tab',
      contributionId: 'tab'
    });
    registerSettingsSectionContribution('com.example.b', {
      id: 'plugin:com.example.b:general',
      title: 'B Settings',
      contributionId: 'general'
    });

    clearPluginContributions('com.example.a');

    expect(
      getRegisteredSettingsSections().every((section) => section.pluginId !== 'com.example.a')
    ).toBe(true);
    expect(getRegisteredRequestTabs().every((tab) => tab.pluginId !== 'com.example.a')).toBe(true);
    expect(
      getRegisteredSettingsSections().some((section) => section.pluginId === 'com.example.b')
    ).toBe(true);

    clearPluginContributions('com.example.b');
  });

  it('unregisterContribution removes a theme by plugin and theme id', () => {
    registerThemeContribution('com.example.theme', {
      id: 'latte',
      title: 'Latte',
      type: 'light'
    });

    expect(getRegisteredPluginThemes()).toHaveLength(1);

    unregisterContribution('com.example.theme', 'themes', 'latte');

    expect(getRegisteredPluginThemes()).toHaveLength(0);

    clearPluginContributions('com.example.theme');
  });
});
