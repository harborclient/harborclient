import { describe, expect, it } from 'vitest';
import { resolveChatStepMode } from '#/shared/ai/chatStepMode';

describe('resolveChatStepMode', () => {
  it('strips search_docs for hub chats when the hub lacks OpenAI', () => {
    const config = resolveChatStepMode(
      {
        hubId: 'hub-1',
        messages: [{ role: 'user', content: 'Hello' }]
      },
      { hubHasOpenAi: false }
    );

    const toolNames = config.tools.map((tool) => tool.function?.name);
    expect(toolNames).not.toContain('search_docs');
    expect(toolNames.length).toBeGreaterThan(0);
  });

  it('keeps search_docs for hub chats when OpenAI is available', () => {
    const config = resolveChatStepMode(
      {
        hubId: 'hub-1',
        messages: [{ role: 'user', content: 'Hello' }]
      },
      { hubHasOpenAi: true }
    );

    const toolNames = config.tools.map((tool) => tool.function?.name);
    expect(toolNames).toContain('search_docs');
  });
});
