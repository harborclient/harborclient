import { describe, expect, it } from 'vitest';
import { DEFAULT_METRICS_CONFIG, normalizeMetricsConfig } from '#/config/metricsConfig.js';

describe('normalizeMetricsConfig', () => {
  it('returns defaults when the section is omitted', () => {
    expect(normalizeMetricsConfig()).toEqual(DEFAULT_METRICS_CONFIG);
  });

  it('applies overrides from a partial metrics section', () => {
    expect(
      normalizeMetricsConfig({
        enabled: false,
        path: 'prometheus',
        authToken: ' secret '
      })
    ).toEqual({
      enabled: false,
      path: '/prometheus',
      authToken: 'secret'
    });
  });

  it('treats blank authToken as unauthenticated', () => {
    expect(normalizeMetricsConfig({ authToken: '   ' }).authToken).toBeNull();
  });
});
