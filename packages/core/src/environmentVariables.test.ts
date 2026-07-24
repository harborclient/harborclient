import { describe, expect, it } from 'vitest';
import type { Variable } from './types';
import {
  appendMissingEnvironmentVariables,
  mergeEnvironmentVariables
} from './environmentVariables';

/**
 * Builds a variable row for merge and append tests.
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

describe('appendMissingEnvironmentVariables', () => {
  it('keeps all target vars unchanged when keys overlap', () => {
    const target = [variable('host', 'bottom.example', 'bottom-default', true)];
    const source = [variable('host', 'top.example', 'top-default', false)];

    expect(appendMissingEnvironmentVariables(target, source)).toEqual({
      variables: [variable('host', 'bottom.example', 'bottom-default', true)],
      addedCount: 0
    });
  });

  it('appends only missing keys from the source list', () => {
    const target = [variable('host', 'bottom.example')];
    const source = [variable('token', 'top-secret'), variable('host', 'top.example')];

    expect(appendMissingEnvironmentVariables(target, source)).toEqual({
      variables: [variable('host', 'bottom.example'), variable('token', 'top-secret')],
      addedCount: 1
    });
  });

  it('ignores blank keys in both lists', () => {
    const target = [variable('  ', 'ignored'), variable('host', 'bottom.example')];
    const source = [variable('', 'also-ignored'), variable('token', 'top-secret')];

    expect(appendMissingEnvironmentVariables(target, source)).toEqual({
      variables: [
        variable('  ', 'ignored'),
        variable('host', 'bottom.example'),
        variable('token', 'top-secret')
      ],
      addedCount: 1
    });
  });

  it('adds only the first source row when the source repeats a key', () => {
    const target = [variable('host', 'bottom.example')];
    const source = [
      variable('token', 'first'),
      variable('token', 'second'),
      variable('region', 'us-east')
    ];

    expect(appendMissingEnvironmentVariables(target, source)).toEqual({
      variables: [
        variable('host', 'bottom.example'),
        variable('token', 'first'),
        variable('region', 'us-east')
      ],
      addedCount: 2
    });
  });

  it('returns zero addedCount when every source key already exists', () => {
    const target = [variable('host', 'bottom.example'), variable('token', 'bottom-token')];
    const source = [variable('host', 'top.example'), variable('token', 'top-token')];

    expect(appendMissingEnvironmentVariables(target, source)).toEqual({
      variables: [variable('host', 'bottom.example'), variable('token', 'bottom-token')],
      addedCount: 0
    });
  });
});
