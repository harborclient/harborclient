import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatStepModeConfig } from '#/shared/ai/chatStepMode';
import { getMcpClientTools } from '#/main/mcp/mcpClientManager';

/**
 * Appends cached MCP client tools to a chat step when the default agent mode is active.
 *
 * @param stepMode - Resolved chat step configuration.
 */
export function mergeMcpClientTools(stepMode: ChatStepModeConfig): ChatCompletionTool[] {
  if (stepMode.toolChoice || stepMode.excludeMcpTools) {
    return stepMode.tools;
  }

  return [...stepMode.tools, ...getMcpClientTools()];
}
