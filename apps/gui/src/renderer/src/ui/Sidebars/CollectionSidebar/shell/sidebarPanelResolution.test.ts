import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RegisteredSidebarPanel } from '@harborclient/core/plugin/types';
import {
  getNonReplacingSidebarPanels,
  resetCollectionsReplacementConflictWarning,
  resolveDisplayedSidebarPanel,
  selectCollectionsReplacementPanel,
  shouldRenderSidebarPanelSwitcher
} from './sidebarPanelResolution';

/**
 * Builds a registered sidebar panel fixture.
 *
 * @param overrides - Fields to set on the panel.
 * @returns A complete {@link RegisteredSidebarPanel}.
 */
function panel(
  overrides: Partial<RegisteredSidebarPanel> & Pick<RegisteredSidebarPanel, 'id'>
): RegisteredSidebarPanel {
  return {
    pluginId: overrides.pluginId ?? 'com.example.a',
    id: overrides.id,
    title: overrides.title ?? 'Panel',
    contributionId: overrides.contributionId ?? 'panel',
    order: overrides.order,
    icon: overrides.icon,
    replaces: overrides.replaces
  };
}

describe('sidebarPanelResolution', () => {
  afterEach(() => {
    resetCollectionsReplacementConflictWarning();
    vi.restoreAllMocks();
  });

  describe('selectCollectionsReplacementPanel', () => {
    it('returns null when no panel replaces collections', () => {
      expect(
        selectCollectionsReplacementPanel([
          panel({ id: 'plugin:a:tools', contributionId: 'tools' })
        ])
      ).toBeNull();
    });

    it('returns the sole collections replacement', () => {
      const winner = panel({
        id: 'plugin:a:collections',
        contributionId: 'collections',
        replaces: 'collections'
      });
      expect(selectCollectionsReplacementPanel([winner])).toBe(winner);
    });

    it('picks the lowest order among replacements', () => {
      const high = panel({
        pluginId: 'com.example.a',
        id: 'plugin:a:high',
        contributionId: 'high',
        replaces: 'collections',
        order: 200
      });
      const low = panel({
        pluginId: 'com.example.b',
        id: 'plugin:b:low',
        contributionId: 'low',
        replaces: 'collections',
        order: 10
      });
      expect(selectCollectionsReplacementPanel([high, low])).toBe(low);
    });

    it('breaks ties by pluginId then contributionId', () => {
      const b = panel({
        pluginId: 'com.example.b',
        id: 'plugin:b:collections',
        contributionId: 'collections',
        replaces: 'collections',
        order: 100
      });
      const a = panel({
        pluginId: 'com.example.a',
        id: 'plugin:a:collections',
        contributionId: 'collections',
        replaces: 'collections',
        order: 100
      });
      expect(selectCollectionsReplacementPanel([b, a])).toBe(a);
    });

    it('warns once when multiple plugins claim replaces: collections', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const first = panel({
        pluginId: 'com.example.a',
        id: 'plugin:a:collections',
        contributionId: 'collections',
        replaces: 'collections',
        order: 10
      });
      const second = panel({
        pluginId: 'com.example.b',
        id: 'plugin:b:collections',
        contributionId: 'collections',
        replaces: 'collections',
        order: 20
      });

      expect(selectCollectionsReplacementPanel([first, second])).toBe(first);
      expect(selectCollectionsReplacementPanel([first, second])).toBe(first);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toMatch(/Multiple plugins claim replaces/);
    });
  });

  describe('resolveDisplayedSidebarPanel', () => {
    const replacement = panel({
      id: 'plugin:a:collections',
      contributionId: 'collections',
      replaces: 'collections',
      title: 'My Collections'
    });
    const tools = panel({
      id: 'plugin:a:tools',
      contributionId: 'tools',
      title: 'Tools'
    });

    it('returns null for primary surface when no replacement exists', () => {
      expect(resolveDisplayedSidebarPanel([tools], null)).toBeNull();
    });

    it('returns the replacement winner when activeId is null', () => {
      expect(resolveDisplayedSidebarPanel([replacement, tools], null)).toBe(replacement);
    });

    it('returns an explicitly selected non-replacing panel', () => {
      expect(resolveDisplayedSidebarPanel([replacement, tools], tools.id)).toBe(tools);
    });

    it('falls back to replacement for a stale activeId', () => {
      expect(resolveDisplayedSidebarPanel([replacement, tools], 'plugin:gone:panel')).toBe(
        replacement
      );
    });

    it('falls back to built-in for a stale activeId without replacement', () => {
      expect(resolveDisplayedSidebarPanel([tools], 'plugin:gone:panel')).toBeNull();
    });
  });

  describe('getNonReplacingSidebarPanels', () => {
    it('filters out collections replacements', () => {
      const replacement = panel({
        id: 'plugin:a:collections',
        contributionId: 'collections',
        replaces: 'collections'
      });
      const tools = panel({ id: 'plugin:a:tools', contributionId: 'tools' });
      expect(getNonReplacingSidebarPanels([replacement, tools])).toEqual([tools]);
    });
  });

  describe('shouldRenderSidebarPanelSwitcher', () => {
    it('shows the switcher when any plugin panels exist without a replacement', () => {
      const tools = panel({ id: 'plugin:a:tools', contributionId: 'tools' });
      expect(shouldRenderSidebarPanelSwitcher([tools], null)).toBe(true);
    });

    it('hides the switcher when only a replacement exists', () => {
      const replacement = panel({
        id: 'plugin:a:collections',
        contributionId: 'collections',
        replaces: 'collections'
      });
      expect(shouldRenderSidebarPanelSwitcher([replacement], replacement)).toBe(false);
    });

    it('shows the switcher when a replacement and non-replacing panels exist', () => {
      const replacement = panel({
        id: 'plugin:a:collections',
        contributionId: 'collections',
        replaces: 'collections'
      });
      const tools = panel({ id: 'plugin:a:tools', contributionId: 'tools' });
      expect(shouldRenderSidebarPanelSwitcher([replacement, tools], replacement)).toBe(true);
    });
  });
});
