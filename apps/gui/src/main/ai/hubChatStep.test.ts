import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runHubChatCompletionStep } from './hubChatStep';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '@harborclient/core/ai/tools';

const completeChatStep = vi.fn().mockResolvedValue({
  content: 'Hello from hub',
  usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
});

vi.mock('#/main/settings/teamHubSettings', () => ({
  listConnectedTeamHubs: vi.fn(() => [
    {
      id: 'hub-1',
      name: 'Team Hub',
      baseUrl: 'http://127.0.0.1:8788',
      token: 'hbk_test'
    }
  ])
}));

vi.mock('#/main/settings/teamHubClient', () => ({
  createTeamHubClient: vi.fn(() => ({
    completeChatStep
  }))
}));

describe('runHubChatCompletionStep', () => {
  /**
   * Resets hub client mocks between examples so call counts stay isolated.
   */
  beforeEach(async () => {
    completeChatStep.mockClear();
    const { createTeamHubClient } = await import('#/main/settings/teamHubClient');
    const { listConnectedTeamHubs } = await import('#/main/settings/teamHubSettings');
    vi.mocked(createTeamHubClient).mockClear();
    vi.mocked(listConnectedTeamHubs).mockReturnValue([
      {
        id: 'hub-1',
        name: 'Team Hub',
        baseUrl: 'http://127.0.0.1:8788',
        token: 'hbk_test'
      }
    ]);
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

  it('includes tenant header when hub has tenantId', async () => {
    const { listConnectedTeamHubs } = await import('#/main/settings/teamHubSettings');
    vi.mocked(listConnectedTeamHubs).mockReturnValue([
      {
        id: 'hub-1',
        name: 'Team Hub',
        baseUrl: 'http://127.0.0.1:8788',
        token: 'hbk_test',
        tenantId: 'tenant-123'
      }
    ]);

    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Tenant response' })
    });
    vi.stubGlobal('fetch', fetchMock);

    await runHubChatCompletionStep(
      {
        hubId: 'hub-1',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      },
      { signal: controller.signal }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/llm/chat/step',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Harbor-Tenant': 'tenant-123'
        })
      })
    );

    vi.unstubAllGlobals();
  });

  it('omits tenant header when hub has no tenantId', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Default tenant response' })
    });
    vi.stubGlobal('fetch', fetchMock);

    await runHubChatCompletionStep(
      {
        hubId: 'hub-1',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      },
      { signal: controller.signal }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/llm/chat/step',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'X-Harbor-Tenant': expect.anything()
        })
      })
    );

    vi.unstubAllGlobals();
  });
});
