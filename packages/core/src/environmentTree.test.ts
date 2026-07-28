import { describe, expect, it } from 'vitest';
import type { Environment, Variable } from './types';
import { normalizeVariable } from './filestore/variables';
import {
  buildEnvironmentTree,
  findNextSiblingEnvironment,
  listInheritedEnvironmentVariables,
  listValidEnvironmentParents,
  mergeEnvironmentChain,
  resolveEnvironmentChain,
  resolveInheritedEnvironmentVariables,
  wouldCreateEnvironmentInheritanceCycle
} from './environmentTree';

/**
 * Builds a test environment with sensible defaults.
 *
 * @param overrides - Fields to override on the environment.
 * @returns Environment fixture.
 */
function makeEnvironment(
  overrides: Partial<Environment> & Pick<Environment, 'id' | 'uuid' | 'name'>
): Environment {
  return {
    variables: [],
    created_at: '2024-01-01T00:00:00.000Z',
    parentUuid: null,
    ...overrides
  };
}

/**
 * Builds an enabled variable row for tests.
 *
 * @param key - Variable key.
 * @param value - Variable value.
 * @param enabled - Whether the row participates in resolution.
 * @returns Variable fixture.
 */
function makeVariable(key: string, value: string, enabled = true): Variable {
  return { key, value, defaultValue: '', enabled, share: false };
}

describe('normalizeVariable enabled default', () => {
  it('defaults missing enabled to true', () => {
    expect(normalizeVariable({ key: 'a', value: '1', share: true }).enabled).toBe(true);
  });

  it('preserves enabled false', () => {
    expect(normalizeVariable({ key: 'a', value: '1', enabled: false, share: false }).enabled).toBe(
      false
    );
  });
});

describe('buildEnvironmentTree', () => {
  it('nests children under parentUuid and treats missing parents as roots', () => {
    const base = makeEnvironment({ id: 1, uuid: 'base', name: 'Base' });
    const child = makeEnvironment({
      id: 2,
      uuid: 'child',
      name: 'Child',
      parentUuid: 'base'
    });
    const orphan = makeEnvironment({
      id: 3,
      uuid: 'orphan',
      name: 'Orphan',
      parentUuid: 'missing'
    });

    const tree = buildEnvironmentTree([base, child, orphan]);
    expect(tree.map((node) => node.environment.uuid)).toEqual(['base', 'orphan']);
    expect(tree[0].children.map((node) => node.environment.uuid)).toEqual(['child']);
  });
});

describe('environment inheritance resolution', () => {
  const base = makeEnvironment({
    id: 1,
    uuid: 'base',
    name: 'Base',
    variables: [makeVariable('API_URL', 'https://base'), makeVariable('TIMEOUT', '30')]
  });
  const staging = makeEnvironment({
    id: 2,
    uuid: 'staging',
    name: 'Staging',
    parentUuid: 'base',
    variables: [makeVariable('API_URL', 'https://staging'), makeVariable('TOKEN', 'abc')]
  });
  const personal = makeEnvironment({
    id: 3,
    uuid: 'personal',
    name: 'Personal',
    parentUuid: 'staging',
    variables: [makeVariable('TOKEN', 'mine'), makeVariable('API_URL', 'disabled', false)]
  });
  const all = [base, staging, personal];

  it('resolves root to leaf chain', () => {
    expect(resolveEnvironmentChain(personal, all).map((env) => env.uuid)).toEqual([
      'base',
      'staging',
      'personal'
    ]);
  });

  it('merges with child overrides and disabled pass-through', () => {
    const merged = resolveInheritedEnvironmentVariables(personal, all);
    const byKey = Object.fromEntries(merged.map((row) => [row.key, row.value]));
    expect(byKey.API_URL).toBe('https://staging');
    expect(byKey.TIMEOUT).toBe('30');
    expect(byKey.TOKEN).toBe('mine');
  });

  it('detects cycles', () => {
    const cyclic = [
      makeEnvironment({ id: 1, uuid: 'a', name: 'A', parentUuid: 'b' }),
      makeEnvironment({ id: 2, uuid: 'b', name: 'B', parentUuid: 'a' })
    ];
    expect(() => resolveEnvironmentChain(cyclic[0], cyclic)).toThrow(/cycle/i);
    expect(wouldCreateEnvironmentInheritanceCycle('a', 'b', cyclic)).toBe(true);
  });

  it('filters inherit-from options to exclude self and descendants', () => {
    const options = listValidEnvironmentParents(base, all);
    expect(options.map((env) => env.uuid)).toEqual([]);
    expect(
      listValidEnvironmentParents(personal, all)
        .map((env) => env.uuid)
        .sort()
    ).toEqual(['base', 'staging']);
  });

  it('lists inherited keys excluding enabled local overrides', () => {
    const inherited = listInheritedEnvironmentVariables(personal, all);
    expect(inherited.map((row) => row.key).sort()).toEqual(['API_URL', 'TIMEOUT']);
    expect(inherited.find((row) => row.key === 'API_URL')?.sourceName).toBe('Staging');
  });

  it('mergeEnvironmentChain skips disabled rows', () => {
    const merged = mergeEnvironmentChain([
      makeEnvironment({
        id: 1,
        uuid: 'a',
        name: 'A',
        variables: [makeVariable('X', 'parent')]
      }),
      makeEnvironment({
        id: 2,
        uuid: 'b',
        name: 'B',
        variables: [makeVariable('X', 'child', false)]
      })
    ]);
    expect(merged).toEqual([makeVariable('X', 'parent')]);
  });
});

describe('findNextSiblingEnvironment', () => {
  it('returns the next sibling under the same parent', () => {
    const environments = [
      makeEnvironment({ id: 1, uuid: 'root-a', name: 'Root A' }),
      makeEnvironment({ id: 2, uuid: 'root-b', name: 'Root B' }),
      makeEnvironment({ id: 3, uuid: 'child-a', name: 'Child A', parentUuid: 'root-a' }),
      makeEnvironment({ id: 4, uuid: 'child-b', name: 'Child B', parentUuid: 'root-a' })
    ];
    expect(findNextSiblingEnvironment(1, environments)?.uuid).toBe('root-b');
    expect(findNextSiblingEnvironment(3, environments)?.uuid).toBe('child-b');
    expect(findNextSiblingEnvironment(2, environments)).toBeUndefined();
  });
});
