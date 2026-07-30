import { describe, expect, it } from 'vitest';
import {
  CUSTOM_THEME_METRIC_GROUPS,
  CUSTOM_THEME_TOKEN_GROUPS
} from '@harborclient/core/types/customTheme';
import { THEME_DESIGNER_CATEGORY_TABS, themeDesignerCategorySlug } from './categoryTabValues';

describe('themeDesignerCategorySlug', () => {
  it('hyphenates multi-word group labels', () => {
    expect(themeDesignerCategorySlug('HTTP methods')).toBe('http-methods');
    expect(themeDesignerCategorySlug('Script stages')).toBe('script-stages');
    expect(themeDesignerCategorySlug('Layout')).toBe('layout');
    expect(themeDesignerCategorySlug('Rail & Sidebars')).toBe('rail-&-sidebars');
  });
});

describe('THEME_DESIGNER_CATEGORY_TABS', () => {
  it('mirrors the color token group order and labels', () => {
    expect(THEME_DESIGNER_CATEGORY_TABS.map((tab) => tab.label)).toEqual(
      CUSTOM_THEME_TOKEN_GROUPS.map((group) => group.label)
    );
  });

  it('uses unique slugs for every category', () => {
    const slugs = THEME_DESIGNER_CATEGORY_TABS.map((tab) => tab.value);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every category a non-empty description', () => {
    for (const tab of THEME_DESIGNER_CATEGORY_TABS) {
      expect(tab.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('covers every metric group so no metric field is unreachable', () => {
    const tabLabels = new Set(THEME_DESIGNER_CATEGORY_TABS.map((tab) => tab.label));
    for (const group of CUSTOM_THEME_METRIC_GROUPS) {
      expect(tabLabels).toContain(group.label);
    }
  });
});
