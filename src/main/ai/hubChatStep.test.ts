import { describe, expect, it, vi } from 'vitest';
import { runHubChatCompletionStep } from '#/main/ai/hubChatStep';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '#/shared/aiTools';

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

vi.mock('#/main/teamHub/TeamHubClient', () => ({
  TeamHubClient: vi.fn(function TeamHubClientMock() {
    return {
      completeChatStep
    };
  })
}));

describe('runHubChatCompletionStep', () => {
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
});
