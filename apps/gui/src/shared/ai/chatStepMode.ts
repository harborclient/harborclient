import { buildChatTitleSystemPrompt, CHAT_TITLE_TOOL } from './chatTitle';
import { buildGitCommitMessageSystemPrompt } from './gitCommitMessage';
import { buildScriptAskSystemPrompt, SCRIPT_ASK_TOOL } from './scriptAsk';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from './tools';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatStepInput, ChatStepMessage } from '#/shared/types';

/**
 * Removes tools that should not be offered for the current chat step context.
 *
 * @param tools - Full Harbor tool definitions for a step.
 * @param input - Renderer-provided step input with optional hub routing.
 * @param hubHasOpenAi - When false for a hub chat, documentation search is disabled.
 */
function filterToolsForChatStep(
  tools: ChatCompletionTool[],
  input: ChatStepInput,
  hubHasOpenAi?: boolean
): ChatCompletionTool[] {
  const hubId = input.hubId?.trim();
  if (!hubId || hubHasOpenAi !== false) {
    return tools;
  }

  return tools.filter((tool) => {
    const name = tool.type === 'function' ? tool.function.name : tool.custom.name;
    return name !== 'search_docs';
  });
}

/**
 * Resolved prompt, tools, and messages for one LLM completion step.
 */
export interface ChatStepModeConfig {
  /**
   * System prompt injected before conversation messages.
   */
  systemPrompt: string;

  /**
   * Tool definitions available to the model for this step.
   */
  tools: ChatCompletionTool[];

  /**
   * Conversation messages sent to the provider for this step.
   */
  messages: ChatStepMessage[];

  /**
   * Optional forced tool choice for mini-agent style steps.
   */
  toolChoice?: { type: 'function'; function: { name: string } };

  /**
   * When true, external MCP client tools are not merged into this step.
   */
  excludeMcpTools?: boolean;
}

/**
 * Resolves system prompt, tools, and messages for a chat completion step.
 *
 * @param input - Renderer-provided step input with optional mode flags.
 * @param options - Optional hub capability hints for tool gating.
 * @returns Configuration for the provider request.
 */
export function resolveChatStepMode(
  input: ChatStepInput,
  options?: { hubHasOpenAi?: boolean }
): ChatStepModeConfig {
  const chatTitlePrompt = input.chatTitlePrompt?.trim();
  if (chatTitlePrompt) {
    return {
      systemPrompt: buildChatTitleSystemPrompt(),
      tools: [CHAT_TITLE_TOOL],
      messages: [{ role: 'user', content: chatTitlePrompt }],
      toolChoice: { type: 'function', function: { name: 'set_chat_title' } },
      excludeMcpTools: true
    };
  }

  if (input.scriptAsk) {
    return {
      systemPrompt: buildScriptAskSystemPrompt(input.scriptAsk),
      tools: [SCRIPT_ASK_TOOL],
      messages: input.messages,
      toolChoice: { type: 'function', function: { name: 'answer_script' } },
      excludeMcpTools: true
    };
  }

  if (input.agentVariant === 'commitMessage') {
    const gitDiffTool = AI_TOOL_DEFINITIONS.find(
      (tool) => tool.type === 'function' && tool.function.name === 'git_diff'
    );
    return {
      systemPrompt: buildGitCommitMessageSystemPrompt(),
      tools: gitDiffTool ? [gitDiffTool] : [],
      messages: input.messages,
      excludeMcpTools: true
    };
  }

  return {
    systemPrompt: AI_SYSTEM_PROMPT,
    tools: filterToolsForChatStep(AI_TOOL_DEFINITIONS, input, options?.hubHasOpenAi),
    messages: input.messages
  };
}
