/**
 * Stable identifier for the automatic default tenant.
 *
 * Used when a request omits a tenant header or when multitenancy is disabled.
 * Reserved: callers cannot create, rename, or delete a tenant with this id.
 */
export const DEFAULT_TENANT_ID = '__default__';

/**
 * HTTP header clients use to select a non-default Team Hub tenant.
 */
export const TENANT_HEADER_NAME = 'x-harbor-tenant';

/**
 * Normalized multitenancy settings loaded from server.yaml.
 */
export interface MultitenancyConfig {
  /**
   * When true, non-default tenants may be selected and managed.
   *
   * When false, only the default tenant is accepted and CLI tenant create/delete
   * commands reject non-default operations.
   */
  enabled: boolean;
}

/**
 * Default multitenancy settings when the section is omitted from server.yaml.
 */
export const DEFAULT_MULTITENANCY_CONFIG: MultitenancyConfig = {
  enabled: false
};

/**
 * Converts a validated YAML multitenancy section into normalized runtime config.
 *
 * @param section - Parsed multitenancy section, or undefined when omitted.
 * @returns Normalized multitenancy settings.
 */
export function normalizeMultitenancyConfig(
  section: { enabled?: boolean } | undefined
): MultitenancyConfig {
  return {
    enabled: section?.enabled ?? false
  };
}

/**
 * Returns whether a tenant id is the reserved default tenant.
 *
 * @param tenantId - Candidate tenant identifier.
 */
export function isDefaultTenantId(tenantId: string): boolean {
  return tenantId === DEFAULT_TENANT_ID;
}

/**
 * Validates and normalizes a tenant identifier.
 *
 * Tenant ids are case-sensitive, trimmed, non-empty, and may contain letters,
 * digits, underscores, and hyphens. The reserved default id is accepted here;
 * callers that create tenants must reject it separately.
 *
 * @param value - Raw tenant id from a header, CLI flag, or create payload.
 * @returns Trimmed tenant id.
 * @throws {Error} When the value is empty or contains invalid characters.
 */
export function normalizeTenantId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Tenant id must not be empty.');
  }

  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error('Tenant id may only contain letters, digits, underscores, and hyphens.');
  }

  if (trimmed.length > 64) {
    throw new Error('Tenant id must be at most 64 characters.');
  }

  return trimmed;
}

/**
 * Resolves the effective tenant id for a request from the optional header value.
 *
 * Missing or blank headers resolve to {@link DEFAULT_TENANT_ID}. When multitenancy
 * is disabled, any non-default tenant is rejected.
 *
 * @param headerValue - Raw `X-Harbor-Tenant` header value, or undefined when absent.
 * @param config - Normalized multitenancy settings.
 * @returns Effective tenant id for the request.
 * @throws {Error} When the header is invalid or multitenancy rejects a non-default tenant.
 */
export function resolveRequestTenantId(
  headerValue: string | undefined,
  config: MultitenancyConfig
): string {
  if (headerValue === undefined || headerValue.trim() === '') {
    return DEFAULT_TENANT_ID;
  }

  const tenantId = normalizeTenantId(headerValue);
  if (!config.enabled && !isDefaultTenantId(tenantId)) {
    throw new Error('Multitenancy is disabled; only the default tenant is available.');
  }

  return tenantId;
}
