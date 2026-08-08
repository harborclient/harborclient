import type { MetricsSection } from '#/config/serverConfig.schema.js';

/**
 * Normalized Prometheus metrics configuration loaded from server.yaml.
 */
export interface MetricsConfig {
  /**
   * When true, registers `/metrics` (or {@link path}) and HTTP request metrics.
   */
  enabled: boolean;

  /**
   * HTTP path for the Prometheus scrape endpoint.
   */
  path: string;

  /**
   * Optional Bearer token required to scrape metrics; null when unauthenticated.
   */
  authToken: string | null;
}

/**
 * Default metrics settings applied when the `metrics` section is omitted.
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  enabled: true,
  path: '/metrics',
  authToken: null
};

/**
 * Normalizes a metrics path so scrapers always hit a rooted absolute path.
 *
 * @param path - Raw path from config or env.
 * @returns Path starting with `/`.
 */
function normalizeMetricsPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return DEFAULT_METRICS_CONFIG.path;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Converts a validated YAML metrics section into normalized runtime config.
 *
 * @param section - Parsed metrics section from server.yaml, when present.
 * @returns Normalized metrics config with defaults applied for omitted fields.
 */
export function normalizeMetricsConfig(section?: MetricsSection): MetricsConfig {
  const authToken = section?.authToken?.trim();

  return {
    enabled: section?.enabled ?? DEFAULT_METRICS_CONFIG.enabled,
    path: normalizeMetricsPath(section?.path ?? DEFAULT_METRICS_CONFIG.path),
    authToken: authToken ? authToken : null
  };
}
