import { useMemo, type JSX } from 'react';
import type { ThemeColorToken, ThemeMetricToken } from '@harborclient/sdk';
import {
  CUSTOM_THEME_METRIC_GROUPS,
  CUSTOM_THEME_TOKEN_GROUPS
} from '@harborclient/core/types/customTheme';
import { ColorTokenField } from './ColorTokenField';
import { MetricTokenField } from './MetricTokenField';
import { DEFAULT_CUSTOM_THEME_METRICS } from './customThemeDefaults';

interface Props {
  /**
   * Token group label shared by the color and metric groups in core.
   */
  groupLabel: string;

  /**
   * Short blurb naming the app surfaces this category restyles, shown above the grid.
   */
  description: string;

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
 * Fields for a single Designer category: typography and geometry first, then the
 * color pickers that style the same part of the interface. Both sets share one
 * fluid grid so related controls sit together instead of in separate sections.
 */
export function ThemeDesignerCategoryPanel({
  groupLabel,
  description,
  colors,
  metrics,
  onColorChange,
  onMetricChange
}: Props): JSX.Element {
  /**
   * Metric tokens for this category, looked up by label because the metric group
   * order in core differs from the color group order.
   */
  const metricTokens = useMemo(
    () => CUSTOM_THEME_METRIC_GROUPS.find((group) => group.label === groupLabel)?.tokens ?? [],
    [groupLabel]
  );

  /**
   * Color tokens for this category.
   */
  const colorTokens = useMemo(
    () => CUSTOM_THEME_TOKEN_GROUPS.find((group) => group.label === groupLabel)?.tokens ?? [],
    [groupLabel]
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 -mt-6">
      <p className="m-0 text-muted">{description}</p>
      <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
        {metricTokens.map((token) => (
          <MetricTokenField
            key={token}
            token={token}
            value={metrics[token] ?? DEFAULT_CUSTOM_THEME_METRICS[token]}
            onChange={onMetricChange}
          />
        ))}
        {colorTokens.map((token) => (
          <ColorTokenField
            key={token}
            token={token}
            value={colors[token] ?? '#000000'}
            onChange={onColorChange}
          />
        ))}
      </div>
    </div>
  );
}
