import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { DEFAULT_GENERAL_SETTINGS, setGeneralSettings } from '#/main/settings/generalSettings';
import { executeScriptAsk, resolveScriptTimeoutMs } from './scriptRunnerHost';

vi.mock('#/main/settings/aiSettings', () => ({
  getAiSettings: vi.fn(() => ({
    openaiApiKey: '',
    claudeApiKey: '',
    geminiApiKey: ''
  }))
}));

vi.mock('#/main/ai/hubChatStep', () => ({
  listHubLlmModels: vi.fn(async () => [])
}));

vi.mock('#/main/ai/githubModelsAuth', () => ({
  getGithubModelsStatus: vi.fn(() => ({ connected: false }))
}));

vi.mock('#/main/ai/completeChatTurn', () => ({
  runChatCompletionStep: vi.fn()
}));

describe('resolveScriptTimeoutMs', () => {
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    settingsStore = {};
    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalDatabase;
    setLocalDatabaseForTesting(database);
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
  });

  it('returns the default script timeout when unset', () => {
    expect(resolveScriptTimeoutMs()).toBe(DEFAULT_GENERAL_SETTINGS.scriptTimeoutMs);
  });

  it('returns persisted scriptTimeoutMs', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptTimeoutMs: 12000
    });

    expect(resolveScriptTimeoutMs()).toBe(12000);
  });

  it('returns 0 when script timeouts are disabled', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptTimeoutMs: 0
    });

    expect(resolveScriptTimeoutMs()).toBe(0);
  });

  it('falls back to default for invalid stored values', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptTimeoutMs: -1
    });

    expect(resolveScriptTimeoutMs()).toBe(DEFAULT_GENERAL_SETTINGS.scriptTimeoutMs);
  });
});

describe('executeScriptAsk', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when AI is not configured', async () => {
    const { getAiSettings } = await import('#/main/settings/aiSettings');
    const { listHubLlmModels } = await import('#/main/ai/hubChatStep');
    const { getGithubModelsStatus } = await import('#/main/ai/githubModelsAuth');
    vi.mocked(getAiSettings).mockReturnValue({
      openaiApiKey: '',
      claudeApiKey: '',
      geminiApiKey: ''
    });
    vi.mocked(listHubLlmModels).mockResolvedValue([]);
    vi.mocked(getGithubModelsStatus).mockReturnValue({ connected: false });

    await expect(
      executeScriptAsk({ prompt: 'Summarize', model: 'GPT-4o Mini: Personal' })
    ).resolves.toBeNull();
  });

  it('returns null when the model/source pair cannot be resolved', async () => {
    const { getAiSettings } = await import('#/main/settings/aiSettings');
    const { listHubLlmModels } = await import('#/main/ai/hubChatStep');
    const { getGithubModelsStatus } = await import('#/main/ai/githubModelsAuth');
    vi.mocked(getAiSettings).mockReturnValue({
      openaiApiKey: 'sk-test',
      claudeApiKey: '',
      geminiApiKey: ''
    });
    vi.mocked(listHubLlmModels).mockResolvedValue([]);
    vi.mocked(getGithubModelsStatus).mockReturnValue({ connected: false });

    await expect(
      executeScriptAsk({ prompt: 'Summarize', model: 'not-a-model: Personal' })
    ).resolves.toBeNull();
  });

  it('returns completion content when the model resolves', async () => {
    const { getAiSettings } = await import('#/main/settings/aiSettings');
    const { listHubLlmModels } = await import('#/main/ai/hubChatStep');
    const { getGithubModelsStatus } = await import('#/main/ai/githubModelsAuth');
    const { runChatCompletionStep } = await import('#/main/ai/completeChatTurn');
    vi.mocked(getAiSettings).mockReturnValue({
      openaiApiKey: 'sk-test',
      claudeApiKey: '',
      geminiApiKey: ''
    });
    vi.mocked(listHubLlmModels).mockResolvedValue([]);
    vi.mocked(getGithubModelsStatus).mockReturnValue({ connected: false });
    vi.mocked(runChatCompletionStep).mockResolvedValue({ content: 'model answer' });

    await expect(
      executeScriptAsk({ prompt: 'Summarize this', model: 'GPT-4o Mini: Personal' })
    ).resolves.toBe('model answer');

    expect(runChatCompletionStep).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Summarize this' }],
      agentVariant: 'hcAsk'
    });
  });

  it('uses the first available model when model is omitted', async () => {
    const { getAiSettings } = await import('#/main/settings/aiSettings');
    const { listHubLlmModels } = await import('#/main/ai/hubChatStep');
    const { getGithubModelsStatus } = await import('#/main/ai/githubModelsAuth');
    const { runChatCompletionStep } = await import('#/main/ai/completeChatTurn');
    vi.mocked(getAiSettings).mockReturnValue({
      openaiApiKey: 'sk-test',
      claudeApiKey: '',
      geminiApiKey: ''
    });
    vi.mocked(listHubLlmModels).mockResolvedValue([]);
    vi.mocked(getGithubModelsStatus).mockReturnValue({ connected: false });
    vi.mocked(runChatCompletionStep).mockResolvedValue({ content: 'first model' });

    await expect(executeScriptAsk({ prompt: 'Hello' })).resolves.toBe('first model');

    expect(runChatCompletionStep).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        agentVariant: 'hcAsk'
      })
    );
  });

  it('includes send context with sizeBytes when run input has a response', async () => {
    const { getAiSettings } = await import('#/main/settings/aiSettings');
    const { listHubLlmModels } = await import('#/main/ai/hubChatStep');
    const { getGithubModelsStatus } = await import('#/main/ai/githubModelsAuth');
    const { runChatCompletionStep } = await import('#/main/ai/completeChatTurn');
    vi.mocked(getAiSettings).mockReturnValue({
      openaiApiKey: 'sk-test',
      claudeApiKey: '',
      geminiApiKey: ''
    });
    vi.mocked(listHubLlmModels).mockResolvedValue([]);
    vi.mocked(getGithubModelsStatus).mockReturnValue({ connected: false });
    vi.mocked(runChatCompletionStep).mockResolvedValue({ content: '68 bytes' });

    const runInput = {
      phase: 'post' as const,
      script: '',
      request: {
        method: 'GET' as const,
        url: 'https://example.com/image.png',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none' as const
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'image/png' },
        body: '',
        bodyBase64: 'aaaa',
        timeMs: 12,
        sizeBytes: 68
      },
      variables: {}
    };

    await expect(
      executeScriptAsk(
        {
          prompt: 'What is the file size of the image?',
          model: 'gpt-4o: Personal'
        },
        runInput
      )
    ).resolves.toBe('68 bytes');

    expect(runChatCompletionStep).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        agentVariant: 'hcAsk',
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('"sizeBytes": 68')
          }),
          { role: 'user', content: 'What is the file size of the image?' }
        ]
      })
    );

    const call = vi.mocked(runChatCompletionStep).mock.calls[0]?.[0];
    expect(call?.messages[0]?.content).not.toContain('aaaa');
  });
});
