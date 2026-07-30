import { SegmentedTabPanel, SegmentedTabs, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import type { ThemeColorToken, ThemeMetricToken } from '@harborclient/sdk';
import type { CustomThemeType } from '@harborclient/core/types/customTheme';
import { ThemeDesignerCategoryPanel } from '../ThemeDesignerCategoryPanel';
import { THEME_DESIGNER_CATEGORY_TABS } from './categoryTabValues';

interface Props {
  /**
   * Base appearance used to resolve color defaults when a draft omits a token.
   */
  type: CustomThemeType;

  /**
   * Current color token values in the Designer draft.
   */
  colors: Partial<Record<ThemeColorToken, string>>;

  /**
   * Current metric token values in the Designer draft.
   */
  metrics: Partial<Record<ThemeMetricToken, string>>;

  /**
   * Updates one color token value in the Designer draft.
   */
  onColorChange: (token: ThemeColorToken, value: string) => void;

  /**
   * Updates one metric token value in the Designer draft.
   */
  onMetricChange: (token: ThemeMetricToken, value: string) => void;
}

/**
 * Tabbed Designer editor with one tab per theme category. Each tab shows the
 * colors and the typography and geometry fields for that category together.
 */
export function ThemeDesignerCategoryTabs({
  type,
  colors,
  metrics,
  onColorChange,
  onMetricChange
}: Props): JSX.Element {
  const [category, setCategory] = useState(THEME_DESIGNER_CATEGORY_TABS[0].value);

  return (
    <SegmentedTabsGroup
      value={category}
      onChange={setCategory}
      ariaLabel="Theme designer categories"
    >
      <div className="min-w-0 w-full">
        <SegmentedTabs tabs={THEME_DESIGNER_CATEGORY_TABS} />
      </div>

      {THEME_DESIGNER_CATEGORY_TABS.map((tab) => (
        <SegmentedTabPanel key={tab.value} value={tab.value} className="pt-4">
          <ThemeDesignerCategoryPanel
            groupLabel={tab.label}
            description={tab.description}
            type={type}
            colors={colors}
            metrics={metrics}
            onColorChange={onColorChange}
            onMetricChange={onMetricChange}
          />
        </SegmentedTabPanel>
      ))}
    </SegmentedTabsGroup>
  );
}
