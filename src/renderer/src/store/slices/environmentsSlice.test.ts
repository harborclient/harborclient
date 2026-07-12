import { describe, expect, it } from 'vitest';
import type { Environment } from '#/shared/types';
import environmentsReducer, {
  reorderEnvironmentsLocal
} from '#/renderer/src/store/slices/environmentsSlice';
import type { EnvironmentsState } from '#/renderer/src/store/slices/environmentsSlice';

const baseEnvironment = (
  overrides: Partial<Environment> & Pick<Environment, 'id' | 'name'>
): Environment => ({
  uuid: `env-${overrides.id}`,
  variables: [],
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const reorderState = (): EnvironmentsState => ({
  environments: [
    baseEnvironment({ id: 1, name: 'Local' }),
    baseEnvironment({ id: 2, name: 'Staging' })
  ],
  activeEnvironmentId: null
});

describe('environmentsSlice reorderEnvironmentsLocal', () => {
  it('reorders environments to match the payload', () => {
    const state = environmentsReducer(
      reorderState(),
      reorderEnvironmentsLocal({ orderedEnvironmentIds: [2, 1] })
    );

    expect(state.environments.map((environment) => environment.id)).toEqual([2, 1]);
  });

  it('ignores invalid reorder payloads', () => {
    const initial = reorderState();
    const state = environmentsReducer(
      initial,
      reorderEnvironmentsLocal({ orderedEnvironmentIds: [1] })
    );

    expect(state.environments.map((environment) => environment.id)).toEqual(
      initial.environments.map((environment) => environment.id)
    );
  });
});
