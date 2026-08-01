import { describe, expect, it } from 'vitest';
import {
  clearPluginContributions,
  getRegisteredLivePageChromeActions,
  getRegisteredPluginThemes,
  getRegisteredRequestTabs,
  getRegisteredSettingsSections,
  getRegisteredSidebarPanels,
  getRegisteredSidebarRailItems,
  getRegisteredWorkflowActionBlocks,
  getRegisteredWorkflowToolbarActions,
  registerLivePageChromeActionContribution,
  registerRequestTabContribution,
  registerSettingsSectionContribution,
  registerSidebarPanelContribution,
  registerSidebarRailItemContribution,
  registerThemeContribution,
  registerWorkflowActionBlockContribution,
  registerWorkflowToolbarActionContribution,
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

  it('stores replaces on registered sidebar panels', () => {
    const disposable = registerSidebarPanelContribution('com.example.replace', {
      id: 'plugin:com.example.replace:collections',
      title: 'My Collections',
      contributionId: 'collections',
      replaces: 'collections',
      order: 10
    });

    expect(getRegisteredSidebarPanels()).toEqual([
      {
        pluginId: 'com.example.replace',
        id: 'plugin:com.example.replace:collections',
        title: 'My Collections',
        contributionId: 'collections',
        replaces: 'collections',
        order: 10
      }
    ]);

    disposable.dispose();
    expect(getRegisteredSidebarPanels()).toHaveLength(0);
  });

  it('registers, sorts, and clears sidebar rail items', () => {
    registerSidebarRailItemContribution('com.example.rail', {
      id: 'plugin:com.example.rail:later',
      title: 'Later',
      icon: 'flask',
      contributionId: 'later',
      order: 50
    });
    registerSidebarRailItemContribution('com.example.rail', {
      id: 'plugin:com.example.rail:first',
      title: 'First',
      icon: 'bolt',
      contributionId: 'first',
      order: 5
    });

    expect(getRegisteredSidebarRailItems().map((item) => item.contributionId)).toEqual([
      'first',
      'later'
    ]);

    unregisterContribution('com.example.rail', 'sidebarRailItems', 'first');
    expect(getRegisteredSidebarRailItems()).toHaveLength(1);
    expect(getRegisteredSidebarRailItems()[0]?.contributionId).toBe('later');

    clearPluginContributions('com.example.rail');
    expect(getRegisteredSidebarRailItems()).toHaveLength(0);
  });

  it('sorts live-page chrome actions by activation order then registration index', () => {
    registerLivePageChromeActionContribution('com.example.second', {
      id: 'b-first',
      title: 'Zebra',
      command: 'b-first',
      icon: 'bolt'
    });
    registerLivePageChromeActionContribution('com.example.second', {
      id: 'b-second',
      title: 'Apple',
      command: 'b-second'
    });
    registerLivePageChromeActionContribution('com.example.first', {
      id: 'a-only',
      title: 'Later plugin',
      command: 'a-only'
    });

    expect(getRegisteredLivePageChromeActions().map((action) => action.id)).toEqual([
      'b-first',
      'b-second',
      'a-only'
    ]);
    expect(getRegisteredLivePageChromeActions()[0]?.activationSeq).toBeLessThan(
      getRegisteredLivePageChromeActions()[2]?.activationSeq ?? Number.POSITIVE_INFINITY
    );
    expect(getRegisteredLivePageChromeActions()[0]?.registrationIndex).toBe(0);
    expect(getRegisteredLivePageChromeActions()[1]?.registrationIndex).toBe(1);

    unregisterContribution('com.example.second', 'livePageChromeActions', 'b-first');
    expect(getRegisteredLivePageChromeActions().map((action) => action.id)).toEqual([
      'b-second',
      'a-only'
    ]);

    clearPluginContributions('com.example.second');
    clearPluginContributions('com.example.first');
    expect(getRegisteredLivePageChromeActions()).toHaveLength(0);

    registerLivePageChromeActionContribution('com.example.first', {
      id: 'a-reactivated',
      title: 'Reactivated first',
      command: 'a-reactivated'
    });
    registerLivePageChromeActionContribution('com.example.second', {
      id: 'b-reactivated',
      title: 'Reactivated second',
      command: 'b-reactivated'
    });
    expect(getRegisteredLivePageChromeActions().map((action) => action.id)).toEqual([
      'a-reactivated',
      'b-reactivated'
    ]);

    clearPluginContributions('com.example.first');
    clearPluginContributions('com.example.second');
  });

  it('registers and unregisters workflow toolbar actions and action blocks', () => {
    const toolbar = registerWorkflowToolbarActionContribution('com.example.wf', {
      id: 'annotate',
      title: 'Annotate',
      command: 'annotate',
      order: 1
    });
    const block = registerWorkflowActionBlockContribution('com.example.wf', {
      id: 'plugin:com.example.wf:badge',
      title: 'Badge',
      contributionId: 'badge',
      actionTypes: ['request.send'],
      order: 2
    });

    expect(getRegisteredWorkflowToolbarActions()).toEqual([
      {
        pluginId: 'com.example.wf',
        id: 'annotate',
        title: 'Annotate',
        command: 'annotate',
        order: 1
      }
    ]);
    expect(getRegisteredWorkflowActionBlocks()).toEqual([
      {
        pluginId: 'com.example.wf',
        id: 'plugin:com.example.wf:badge',
        title: 'Badge',
        contributionId: 'badge',
        actionTypes: ['request.send'],
        order: 2
      }
    ]);

    unregisterContribution('com.example.wf', 'workflowToolbarActions', 'annotate');
    unregisterContribution('com.example.wf', 'workflowActionBlocks', 'badge');
    expect(getRegisteredWorkflowToolbarActions()).toHaveLength(0);
    expect(getRegisteredWorkflowActionBlocks()).toHaveLength(0);

    toolbar.dispose();
    block.dispose();
    clearPluginContributions('com.example.wf');
  });
});
