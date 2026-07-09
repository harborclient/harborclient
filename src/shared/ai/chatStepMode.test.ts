import { describe, expect, it } from 'vitest';
import { resolveChatStepMode } from '#/shared/ai/chatStepMode';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Returns the provider tool name for a chat completion tool definition.
 *
 * @param tool - OpenAI chat completion tool entry.
 */
function getToolName(tool: ChatCompletionTool): string {
  return tool.type === 'function' ? tool.function.name : tool.custom.name;
}

describe('resolveChatStepMode', () => {
  it('strips search_docs for hub chats when the hub lacks OpenAI', () => {
    const config = resolveChatStepMode(
      {
        model: 'gpt-4o',
        hubId: 'hub-1',
        messages: [{ role: 'user', content: 'Hello' }]
      },
      { hubHasOpenAi: false }
    );

    const toolNames = config.tools.map(getToolName);
    expect(toolNames).not.toContain('search_docs');
    expect(toolNames.length).toBeGreaterThan(0);
  });

  it('keeps search_docs for hub chats when OpenAI is available', () => {
    const config = resolveChatStepMode(
      {
        model: 'gpt-4o',
        hubId: 'hub-1',
        messages: [{ role: 'user', content: 'Hello' }]
      },
      { hubHasOpenAi: true }
    );

    const toolNames = config.tools.map(getToolName);
    expect(toolNames).toContain('search_docs');
  });
});
