import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEnvironmentWithVariables,
  pluginVariablesToVariables,
  updateEnvironmentVariables
} from './hostEnvironmentCommands';

const dispatchMock = vi.fn();
const unwrapMock = vi.fn();

vi.mock('#/renderer/src/store/redux', () => ({
  store: {
    dispatch: (...args: unknown[]) => dispatchMock(...args),
    getState: () => ({
      environments: {
        environments: [{ id: 7, name: 'Dev', variables: [], uuid: 'u', created_at: '' }]
      }
    })
  }
}));

vi.mock('#/renderer/src/store/thunks/environments', () => ({
  createEnvironment: (name: string) => ({ type: 'createEnvironment', payload: name }),
  updateEnvironment: (payload: unknown) => ({ type: 'updateEnvironment', payload })
}));

beforeEach(() => {
  dispatchMock.mockReset();
  unwrapMock.mockReset();
  dispatchMock.mockReturnValue({ unwrap: unwrapMock });
  unwrapMock.mockResolvedValue({ id: 7, name: 'Dev' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('pluginVariablesToVariables', () => {
  it('normalizes plugin variable rows', () => {
    expect(
      pluginVariablesToVariables([{ key: ' API_URL ', value: 'https://example.com', share: true }])
    ).toEqual([
      {
        key: 'API_URL',
        value: 'https://example.com',
        defaultValue: '',
        share: true
      }
    ]);
  });

  it('rejects empty keys', () => {
    expect(() => pluginVariablesToVariables([{ key: '  ', value: 'x' }])).toThrow(
      /non-empty strings/
    );
  });
});

describe('createEnvironmentWithVariables', () => {
  it('creates an environment and updates variables', async () => {
    unwrapMock.mockResolvedValueOnce({ id: 9, name: 'Local' }).mockResolvedValueOnce(undefined);

    const result = await createEnvironmentWithVariables('Local', [{ key: 'TOKEN', value: 'abc' }]);

    expect(result).toEqual({ id: 9, name: 'Local' });
    expect(dispatchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects empty names', async () => {
    await expect(createEnvironmentWithVariables('  ', [])).rejects.toThrow(/name is required/);
  });
});

describe('updateEnvironmentVariables', () => {
  it('replaces variables on an existing environment', async () => {
    unwrapMock.mockResolvedValue(undefined);

    await updateEnvironmentVariables(7, [{ key: 'TOKEN', value: 'next' }]);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'updateEnvironment',
      payload: {
        id: 7,
        name: 'Dev',
        variables: [{ key: 'TOKEN', value: 'next', defaultValue: '', share: false }]
      }
    });
  });

  it('rejects unknown environment ids', async () => {
    await expect(updateEnvironmentVariables(999, [])).rejects.toThrow(/not available/);
  });
});
