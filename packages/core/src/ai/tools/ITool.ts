import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { z } from 'zod';

/**
 * Contract every Harbor AI agent tool must satisfy.
 *
 * Each tool file exports a const that implements this interface so the barrel
 * can derive `AI_TOOL_NAMES`, `AI_TOOL_DEFINITIONS`, and MCP input shapes from
 * a single source of truth.
 *
 * @typeParam Name - Literal tool name string (for example `'get_collection'`).
 */
export interface ITool<Name extends string = string> {
  /**
   * Stable tool name sent to the model and used as the MCP tool id.
   */
  readonly name: Name;

  /**
   * OpenAI Chat Completions tool definition (type + function schema).
   */
  readonly definition: ChatCompletionTool;

  /**
   * Zod raw shape for MCP `inputSchema` registration.
   */
  readonly inputShape: Record<string, z.ZodType>;
}
