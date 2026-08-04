import { describe, expect, it } from 'vitest';
import type { ShortcutBinding } from '@harborclient/core/shortcuts';
import { SHORTCUT_DEFS } from '@harborclient/core/shortcuts';
import { buildShortcutTutorLevels } from './shortcutTutorLevels';

/**
 * Builds resolved bindings from registry defaults for level tests.
 *
 * @returns Default shortcut bindings.
 */
function defaultBindings(): ShortcutBinding[] {
  return SHORTCUT_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    accelerator: def.defaultAccelerator,
    defaultAccelerator: def.defaultAccelerator
  }));
}

describe('buildShortcutTutorLevels', () => {
  it('builds four cumulative levels with increasing shortcode counts', () => {
    const levels = buildShortcutTutorLevels(defaultBindings(), 'linux');

    expect(levels).toHaveLength(4);
    expect(levels[0]?.name).toContain('Level 1');
    expect(levels[3]?.name).toContain('Level 4');

    const counts = levels.map((level) => Object.keys(level.shortcodes).length);
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(counts[0]!);
    expect(counts[2]).toBeGreaterThan(counts[1]!);
    expect(counts[3]).toBeGreaterThan(counts[2]!);
  });

  it('includes send-request in level 1 using the resolved accelerator', () => {
    const levels = buildShortcutTutorLevels(defaultBindings(), 'linux');
    expect(levels[0]?.shortcodes['f5']).toBe('Send request');
  });

  it('skips empty accelerators in level 4', () => {
    const levels = buildShortcutTutorLevels(defaultBindings(), 'linux');
    const labels = Object.values(levels[3]?.shortcodes ?? {});
    expect(labels).not.toContain('New collection (Git)');
  });
});
