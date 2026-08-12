import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runHubChatCompletionStep } from './hubChatStep';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '@harborclient/core/ai/tools';

const { completeChatStep, completeChatStepStream, pushAiChatStreamMessage } = vi.hoisted(() => ({
  completeChatStep: vi.fn().mockResolvedValue({
    content: 'Hello from hub',
    usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
  }),
  completeChatStepStream: vi.fn(),
  pushAiChatStreamMessage: vi.fn()
}));

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
    completeChatStep,
    completeChatStepStream
  }))
}));

vi.mock('./pushAiChatStreamMessage', () => ({
  pushAiChatStreamMessage
}));

describe('runHubChatCompletionStep', () => {
  /**
   * Resets hub client mocks between examples so call counts stay isolated.
   */
  beforeEach(async () => {
    completeChatStep.mockClear();
    completeChatStepStream.mockReset();
    pushAiChatStreamMessage.mockClear();
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

  it('uses the Team Hub client stream and forwards canonical events without a signal', async () => {
    const stepEnd = {
      v: 1 as const,
      type: 'step.end' as const,
      turnId: 'turn-1',
      stepIndex: 3,
      content: 'Streamed client response'
    };
    completeChatStepStream.mockImplementation(async (_input, handlers) => {
      handlers.onEvent(stepEnd);
      return { content: stepEnd.content };
    });

    const result = await runHubChatCompletionStep(
      {
        hubId: 'hub-1',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      },
      { streamContext: { chatId: 42, turnId: 'turn-1', stepIndex: 3 } }
    );

    expect(completeChatStep).not.toHaveBeenCalled();
    expect(completeChatStepStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        turnId: 'turn-1',
        stepIndex: 3
      }),
      { onEvent: expect.any(Function) }
    );
    expect(pushAiChatStreamMessage).toHaveBeenCalledWith(42, stepEnd);
    expect(result).toEqual({ content: 'Streamed client response' });
  });

  it('uses the abortable raw SSE path and returns the step.end result', async () => {
    const events = [
      { v: 1, type: 'step.start', turnId: 'turn-2', stepIndex: 1 },
      {
        v: 1,
        type: 'step.end',
        turnId: 'turn-2',
        stepIndex: 1,
        content: 'Raw stream response'
      }
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await runHubChatCompletionStep(
      {
        hubId: 'hub-1',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      },
      {
        signal: new AbortController().signal,
        streamContext: { chatId: 7, turnId: 'turn-2', stepIndex: 1 }
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/llm/chat/stream',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'text/event-stream' }),
        body: expect.stringContaining('"turnId":"turn-2"')
      })
    );
    expect(pushAiChatStreamMessage).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ content: 'Raw stream response' });

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
