import { describe, expect, it } from 'vitest';
import {
  CUSTOM_THEME_METRIC_GROUPS,
  CUSTOM_THEME_METRIC_LABELS,
  CUSTOM_THEME_METRICS,
  CUSTOM_THEME_TOKEN_GROUPS,
  CUSTOM_THEME_TOKEN_LABELS,
  CUSTOM_THEME_TOKENS,
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

describe('customTheme Rail & Sidebars color tokens', () => {
  it('groups rail and sidebar colors in a dedicated Designer category', () => {
    const railGroup = CUSTOM_THEME_TOKEN_GROUPS.find((group) => group.label === 'Rail & Sidebars');

    expect(railGroup).toEqual({
      label: 'Rail & Sidebars',
      tokens: [
        'sidebar-rail',
        'sidebar-rail-active',
        'sidebar-rail-text',
        'sidebar-rail-separator',
        'sidebar',
        'sidebar-toolbar',
        'sidebar-section',
        'sidebar-section-text'
      ]
    });
    expect(CUSTOM_THEME_TOKENS).toContain('sidebar-rail-separator');
    expect(CUSTOM_THEME_TOKEN_LABELS['sidebar-rail-separator']).toBe('Sidebar rail separator');
  });

  it('keeps Layout and Text free of rail and sidebar color tokens', () => {
    const layout = CUSTOM_THEME_TOKEN_GROUPS.find((group) => group.label === 'Layout');
    const text = CUSTOM_THEME_TOKEN_GROUPS.find((group) => group.label === 'Text');

    expect(layout?.tokens).toEqual([
      'surface',
      'header',
      'footer',
      'control',
      'field',
      'separator',
      'terminal'
    ]);
    expect(CUSTOM_THEME_TOKEN_LABELS.header).toBe('Header');
    expect(text?.tokens).toEqual([
      'text',
      'text-secondary',
      'muted',
      'footer-text',
      'footer-muted'
    ]);
  });
});
