import { describe, expect, it } from 'vitest';
import {
  CUSTOM_THEME_METRIC_GROUPS,
  CUSTOM_THEME_METRIC_LABELS,
  CUSTOM_THEME_METRICS,
  customThemeMetricControlKind
} from './customTheme';

describe('customTheme metric tokens', () => {
  it('exposes scrollbar-width in the Designer Scrollbar group', () => {
    const scrollbarGroup = CUSTOM_THEME_METRIC_GROUPS.find((group) => group.label === 'Scrollbar');

    expect(scrollbarGroup).toEqual({
      label: 'Scrollbar',
      tokens: ['scrollbar-width']
    });
    expect(CUSTOM_THEME_METRICS).toContain('scrollbar-width');
    expect(CUSTOM_THEME_METRIC_LABELS['scrollbar-width']).toBe('Width');
    expect(customThemeMetricControlKind('scrollbar-width')).toBe('length');
  });
});
