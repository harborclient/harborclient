import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runHubChatCompletionStep } from './hubChatStep';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '#/shared/ai/tools';

const completeChatStep = vi.fn().mockResolvedValue({
  content: 'Hello from hub',
  usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
});

vi.mock('#/main/settings/teamHubSettings', () => ({
  listTeamHubs: vi.fn(() => [
    {
      id: 'hub-1',
      name: 'Team Hub',
      baseUrl: 'http://127.0.0.1:8788',
      token: 'hbk_test'
    }
  ])
}));

vi.mock('@harborclient/team-hub-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@harborclient/team-hub-api')>()),
  TeamHubClient: vi.fn(function TeamHubClientMock() {
    return {
      completeChatStep
    };
  })
}));

describe('runHubChatCompletionStep', () => {
  /**
   * Resets hub client mocks between examples so call counts stay isolated.
   */
  beforeEach(() => {
    completeChatStep.mockClear();
  });

  it('forwards tools and the system prompt to the Team Hub client', async () => {
    const result = await runHubChatCompletionStep({
      hubId: 'hub-1',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }]
    });

    expect(completeChatStep).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: AI_TOOL_DEFINITIONS,
      systemPrompt: AI_SYSTEM_PROMPT
    });
    expect(result.content).toBe('Hello from hub');
  });

  it('uses abortable fetch when an abort signal is provided', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Stopped path' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await runHubChatCompletionStep(
      {
        hubId: 'hub-1',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      },
      { signal: controller.signal }
    );

    expect(completeChatStep).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/llm/chat/step',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
    expect(result.content).toBe('Stopped path');

    vi.unstubAllGlobals();
  });
});
