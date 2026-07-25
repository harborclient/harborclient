import type { JSX } from 'react';
import type { ThemeMetricToken } from '@harborclient/sdk';
import { CUSTOM_THEME_METRIC_GROUPS } from '@harborclient/core/types/customTheme';
import { DEFAULT_CUSTOM_THEME_METRICS } from './customThemeDefaults';
import { MetricTokenField } from './MetricTokenField';

interface Props {
  /**
   * Current metric token values in the Designer draft.
   */
  metrics: Partial<Record<ThemeMetricToken, string>>;

  /**
   * Updates one metric token value in the Designer draft.
   */
  onChange: (token: ThemeMetricToken, value: string) => void;
}

/**
 * Grouped fluid grid of theme metric editors for the Designer form.
 */
export function MetricTokenGrid({ metrics, onChange }: Props): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {CUSTOM_THEME_METRIC_GROUPS.map((group) => (
        <section key={group.label} aria-labelledby={`designer-metric-group-${group.label}`}>
          <h3
            id={`designer-metric-group-${group.label}`}
            className="m-0 mb-3 text-[14px] font-semibold text-text"
          >
            {group.label}
          </h3>
          <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
            {group.tokens.map((token) => (
              <MetricTokenField
                key={token}
                token={token}
                value={metrics[token] ?? DEFAULT_CUSTOM_THEME_METRICS[token]}
                onChange={onChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
