import { beforeEach, describe, expect, it } from 'vitest';
import type { SerializableMenuContribution } from '@harborclient/core/plugin/types';
import { getPluginMenuContributions, setPluginMenuContributions } from './pluginMenuContributions';

/**
 * Builds one menu contribution for equality tests.
 *
 * @param overrides - Fields to merge onto the base entry.
 */
function contribution(
  overrides: Partial<SerializableMenuContribution> = {}
): SerializableMenuContribution {
  return {
    pluginId: 'com.example.plugin',
    menu: 'view',
    command: 'example.command',
    label: 'Example',
    group: 'navigation',
    order: 10,
    ...overrides
  };
}

describe('setPluginMenuContributions', () => {
  /**
   * Seeds a distinct contribution so each test starts from a known changed state.
   */
  beforeEach(() => {
    setPluginMenuContributions([contribution({ pluginId: 'com.example.reset', label: 'Reset' })]);
  });

  it('returns true only when the contribution list changes', () => {
    expect(setPluginMenuContributions([contribution()])).toBe(true);
    expect(setPluginMenuContributions([contribution()])).toBe(false);
    expect(setPluginMenuContributions([contribution({ label: 'Renamed' })])).toBe(true);
    expect(getPluginMenuContributions()).toEqual([contribution({ label: 'Renamed' })]);
  });

  it('treats an empty list as unchanged after the first empty sync', () => {
    expect(setPluginMenuContributions([])).toBe(true);
    expect(setPluginMenuContributions([])).toBe(false);
  });
});
