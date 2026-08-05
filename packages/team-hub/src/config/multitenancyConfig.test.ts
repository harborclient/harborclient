import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MULTITENANCY_CONFIG,
  DEFAULT_TENANT_ID,
  normalizeMultitenancyConfig,
  normalizeTenantId,
  resolveRequestTenantId
} from '#/config/multitenancyConfig.js';

describe('normalizeMultitenancyConfig', () => {
  it('defaults to disabled when the section is omitted', () => {
    expect(normalizeMultitenancyConfig(undefined)).toEqual(DEFAULT_MULTITENANCY_CONFIG);
  });

  it('preserves an explicit enabled flag', () => {
    expect(normalizeMultitenancyConfig({ enabled: true })).toEqual({ enabled: true });
  });
});

describe('normalizeTenantId', () => {
  it('trims a valid tenant id', () => {
    expect(normalizeTenantId('  acme-1_team  ')).toBe('acme-1_team');
  });

  it('rejects empty and invalid ids', () => {
    expect(() => normalizeTenantId('')).toThrow('Tenant id must not be empty.');
    expect(() => normalizeTenantId('acme/team')).toThrow(
      'letters, digits, underscores, and hyphens'
    );
  });
});

describe('resolveRequestTenantId', () => {
  it('uses the default tenant when the header is missing', () => {
    expect(resolveRequestTenantId(undefined, { enabled: false })).toBe(DEFAULT_TENANT_ID);
    expect(resolveRequestTenantId('   ', { enabled: true })).toBe(DEFAULT_TENANT_ID);
  });

  it('accepts the default tenant header even when multitenancy is disabled', () => {
    expect(resolveRequestTenantId(DEFAULT_TENANT_ID, { enabled: false })).toBe(DEFAULT_TENANT_ID);
  });

  it('rejects non-default tenants when multitenancy is disabled', () => {
    expect(() => resolveRequestTenantId('acme', { enabled: false })).toThrow(
      'Multitenancy is disabled'
    );
  });

  it('accepts non-default tenants when multitenancy is enabled', () => {
    expect(resolveRequestTenantId('acme', { enabled: true })).toBe('acme');
  });
});
