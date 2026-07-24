import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getGlobalVariables,
  setGlobalVariable,
  updateGlobalVariables
} from './hostGlobalsCommands';

const dispatchMock = vi.fn();
const unwrapMock = vi.fn();

vi.mock('#/renderer/src/store/redux', () => ({
  store: {
    dispatch: (...args: unknown[]) => dispatchMock(...args),
    getState: () => ({
      settings: {
        general: {
          globalVariables: [
            { key: 'TOKEN', value: 'abc', defaultValue: '', share: false, enabled: true }
          ]
        }
      }
    })
  }
}));

vi.mock('#/renderer/src/store/thunks/settings', () => ({
  saveGlobalVariables: (variables: unknown) => ({ type: 'saveGlobalVariables', payload: variables })
}));

beforeEach(() => {
  dispatchMock.mockReset();
  unwrapMock.mockReset();
  dispatchMock.mockReturnValue({ unwrap: unwrapMock });
  unwrapMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('setGlobalVariable', () => {
  it('upserts one global without removing existing rows', async () => {
    await setGlobalVariable('echoBaseUrl', 'http://localhost:4335');

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'saveGlobalVariables',
      payload: [
        { key: 'TOKEN', value: 'abc', defaultValue: '', share: false, enabled: true },
        {
          key: 'echoBaseUrl',
          value: 'http://localhost:4335',
          defaultValue: '',
          share: false,
          enabled: true
        }
      ]
    });
  });

  it('updates an existing global by key', async () => {
    await setGlobalVariable('TOKEN', 'next');

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'saveGlobalVariables',
      payload: [{ key: 'TOKEN', value: 'next', defaultValue: '', share: false, enabled: true }]
    });
  });

  it('rejects empty names', async () => {
    await expect(setGlobalVariable('  ', 'x')).rejects.toThrow(/name is required/);
  });
});

describe('getGlobalVariables', () => {
  it('reads globals from the settings slice', () => {
    expect(getGlobalVariables()).toEqual([
      { key: 'TOKEN', value: 'abc', defaultValue: '', share: false, enabled: true }
    ]);
  });
});

describe('updateGlobalVariables', () => {
  it('replaces the full global variable list', async () => {
    await updateGlobalVariables([{ key: 'ONLY', value: 'one' }]);

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'saveGlobalVariables',
      payload: [{ key: 'ONLY', value: 'one', defaultValue: '', share: false }]
    });
  });
});
