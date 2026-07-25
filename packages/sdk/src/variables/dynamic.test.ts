import { describe, expect, it } from 'vitest';
import {
  DYNAMIC_VARIABLES,
  DYNAMIC_VARIABLE_CATEGORIES,
  DYNAMIC_VARIABLE_NAMES,
  getDynamicVariableDescription,
  isDynamicVariable,
  resolveDynamicVariable
} from './dynamic.js';

describe('dynamicVariables', () => {
  it('registers all Postman-style dynamic variable names with $ prefix', () => {
    expect(DYNAMIC_VARIABLE_NAMES.length).toBeGreaterThan(100);
    for (const name of DYNAMIC_VARIABLE_NAMES) {
      expect(name.startsWith('$')).toBe(true);
    }
  });

  it('generates a non-empty value for every registered dynamic variable', () => {
    for (const name of DYNAMIC_VARIABLE_NAMES) {
      const value = resolveDynamicVariable(name);
      expect(value).toBeDefined();
      expect(value!.length).toBeGreaterThan(0);
    }
  });

  it('isDynamicVariable and getDynamicVariableDescription reflect the registry', () => {
    expect(isDynamicVariable('$guid')).toBe(true);
    expect(isDynamicVariable('$randomFirstName')).toBe(true);
    expect(isDynamicVariable('host')).toBe(false);
    expect(isDynamicVariable('$unknownDynamic')).toBe(false);

    expect(getDynamicVariableDescription('$guid')).toBe(DYNAMIC_VARIABLES.$guid.description);
    expect(getDynamicVariableDescription('host')).toBeUndefined();
  });

  it('resolveDynamicVariable returns undefined for unknown keys', () => {
    expect(resolveDynamicVariable('$notARealVariable')).toBeUndefined();
  });

  it('$guid and $randomUUID produce uuid-v4 shaped values', () => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(resolveDynamicVariable('$guid')).toMatch(uuidPattern);
    expect(resolveDynamicVariable('$randomUUID')).toMatch(uuidPattern);
  });

  it('$timestamp returns a numeric unix seconds string', () => {
    const value = resolveDynamicVariable('$timestamp');
    expect(value).toMatch(/^\d+$/);
    const seconds = Number(value);
    expect(seconds).toBeGreaterThan(1_500_000_000);
    expect(seconds).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it('$isoTimestamp returns an ISO-8601 UTC string', () => {
    const value = resolveDynamicVariable('$isoTimestamp');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(() => new Date(value!).toISOString()).not.toThrow();
  });

  it('generates fresh values on each resolve call for random variables', () => {
    const first = resolveDynamicVariable('$randomInt');
    const second = resolveDynamicVariable('$randomInt');
    expect(first).toMatch(/^\d+$/);
    expect(second).toMatch(/^\d+$/);
  });

  it('lists every dynamic variable exactly once across documentation categories', () => {
    const categorized = DYNAMIC_VARIABLE_CATEGORIES.flatMap((category) => category.keys);
    const unique = new Set(categorized);

    expect(categorized.length).toBe(DYNAMIC_VARIABLE_NAMES.length);
    expect(unique.size).toBe(DYNAMIC_VARIABLE_NAMES.length);

    for (const name of DYNAMIC_VARIABLE_NAMES) {
      expect(unique.has(name)).toBe(true);
    }
  });
});
