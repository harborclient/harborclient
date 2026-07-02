import { describe, expect, it } from 'vitest';
import type { Variable } from '#/shared/types';
import { mergeEnvironmentVariables } from '#/shared/environmentVariables';

/**
 * Builds a variable row for merge tests.
 *
 * @param key - Variable key.
 * @param value - Resolved value.
 * @param defaultValue - Fallback when value is empty.
 * @param share - Whether the value is included in exports.
 */
function variable(key: string, value: string, defaultValue = '', share = false): Variable {
  return { key, value, defaultValue, share };
}

describe('mergeEnvironmentVariables', () => {
  it('keeps keys unique to each list', () => {
    const base = [variable('host', 'bottom.example')];
    const override = [variable('token', 'top-secret')];

    expect(mergeEnvironmentVariables(base, override)).toEqual([
      variable('host', 'bottom.example'),
      variable('token', 'top-secret')
    ]);
  });

  it('replaces duplicate keys with the override row', () => {
    const base = [variable('host', 'bottom.example', 'bottom-default', true)];
    const override = [variable('host', 'top.example', 'top-default', false)];

    expect(mergeEnvironmentVariables(base, override)).toEqual([
      variable('host', 'top.example', 'top-default', false)
    ]);
  });

  it('ignores rows with empty trimmed keys', () => {
    const base = [variable('  ', 'ignored'), variable('host', 'bottom.example')];
    const override = [variable('', 'also-ignored'), variable('token', 'top-secret')];

    expect(mergeEnvironmentVariables(base, override)).toEqual([
      variable('host', 'bottom.example'),
      variable('token', 'top-secret')
    ]);
  });
});
