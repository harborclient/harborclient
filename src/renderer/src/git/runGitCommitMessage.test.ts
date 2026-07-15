import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings, ChatStepResult } from '#/shared/types';
import { runGitCommitMessage } from './runGitCommitMessage';

const completeChatStepMock =
  vi.fn<(input: unknown, stepRequestId?: string) => Promise<ChatStepResult>>();
const executeAiToolCallMock =
  vi.fn<(name: string, rawArgs: string, ctx: unknown) => Promise<string>>();

vi.mock('#/renderer/src/store/ai/aiToolExecutor', () => ({
  executeAiToolCall: (name: string, rawArgs: string, ctx: unknown) =>
    executeAiToolCallMock(name, rawArgs, ctx)
}));

const aiSettings: AiSettings = {
  openaiApiKey: 'test-key',
  claudeApiKey: '',
  geminiApiKey: ''
};

/**
 * Minimal in-memory localStorage mock for model persistence helpers.
 */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  };
}

describe('runGitCommitMessage', () => {
  beforeEach(() => {
    completeChatStepMock.mockReset();
    executeAiToolCallMock.mockReset();
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.stubGlobal('window', {
      api: {
        completeChatStep: completeChatStepMock
      }
    });
  });

  it('runs git_diff then returns a normalized commit subject', async () => {
    completeChatStepMock
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          {
            id: 'call-1',
            name: 'git_diff',
            arguments: JSON.stringify({ collectionUuid: 'uuid-1' })
          }
        ]
      })
      .mockResolvedValueOnce({
        content: 'Add OAuth refresh handling.',
        toolCalls: []
      });
    executeAiToolCallMock.mockResolvedValue(
      JSON.stringify({ changedFileCount: 1, files: [{ path: 'foo.json', status: 'modified' }] })
    );

    const { store } = await import('#/renderer/src/store/redux');

    const result = await runGitCommitMessage({
      collectionUuid: 'uuid-1',
      connectionName: 'Git repo',
      modelId: 'gpt-4o',
      aiSettings,
      hubModelGroups: [],
      dispatch: store.dispatch,
      getState: store.getState
    });

    expect(executeAiToolCallMock).toHaveBeenCalledWith(
      'git_diff',
      JSON.stringify({ collectionUuid: 'uuid-1' }),
      expect.any(Object)
    );
    expect(result).toBe('Add OAuth refresh handling');
  });

  it('returns null when cancelled before completion', async () => {
    completeChatStepMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        content: 'Should not apply',
        toolCalls: []
      };
    });

    const { store } = await import('#/renderer/src/store/redux');
    let cancelled = false;

    const pending = runGitCommitMessage({
      collectionUuid: 'uuid-1',
      connectionName: 'Git repo',
      modelId: 'gpt-4o',
      aiSettings,
      hubModelGroups: [],
      dispatch: store.dispatch,
      getState: store.getState,
      isCancelled: () => cancelled
    });

    cancelled = true;
    const result = await pending;

    expect(result).toBeNull();
  });
});
