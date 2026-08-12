import type { DocsConfig } from '#/config/docsConfig.js';
import type { LlmConfig } from '#/config/llmConfig.js';
import {
  runLlmCompletion,
  runLlmCompletionStream,
  type LlmChatMessage,
  type LlmCompletionResult,
  type LlmCompletionUsage,
  type LlmToolCall,
  type LlmToolDefinition
} from '#/server/llm/client.js';
import {
  callHubNativeTool,
  filterClientToolsForHub,
  isHubNativeToolName,
  type HubNativeToolName
} from '#/server/llm/hubNativeTools.js';
import { isHubMcpToolName } from '#/server/llm/hubMcpToolNames.js';
import {
  callHubMcpTool,
  ensureHubMcpConnections,
  listHubMcpTools,
  type HubMcpOpenAiTool
} from '#/server/llm/mcpClient.js';
import {
  AI_AGENT_MAX_HUB_INNER_ITERATIONS,
  AI_CHAT_STREAM_EVENT_VERSION,
  type AiChatStreamEvent
} from '#/server/llm/aiChatStreamContract.js';

/**
 * Input for one hub chat step, including client tools and conversation history.
 */
export interface HubChatStepInput {
  model: string;
  messages: LlmChatMessage[];
  systemPrompt?: string;
  tools?: LlmToolDefinition[];
}

/**
 * Result of one hub chat step after optional server-side tool execution.
 */
export interface HubChatStepResult {
  content: string | null;
  toolCalls?: LlmToolCall[];
  usage: LlmCompletionUsage;
  /**
   * Indicates which nested agent boundary stopped the completion when it
   * exhausted its allowed iterations.
   */
  iteration?: {
    hitIterationLimit: boolean;
    boundary: 'hub_inner';
  };
}

/**
 * Injectable dependencies for {@link runHubChatStep} in tests.
 */
export interface HubChatStepDeps {
  runCompletion: (
    config: LlmConfig,
    input: {
      model: string;
      messages: LlmChatMessage[];
      systemPrompt?: string;
      tools?: HubChatStepInput['tools'];
    }
  ) => Promise<LlmCompletionResult>;
  ensureConnections: (config: LlmConfig) => Promise<void>;
  listTools: () => HubMcpOpenAiTool[];
  callTool: (prefixedName: string, args: unknown) => Promise<string>;
  callNativeTool: (
    name: HubNativeToolName,
    args: unknown,
    config: LlmConfig,
    docsConfig: DocsConfig | null
  ) => Promise<string>;

  /**
   * Runs a completion while yielding text to the stream owner.
   */
  runCompletionStream?: (
    config: LlmConfig,
    input: Parameters<HubChatStepDeps['runCompletion']>[1],
    options: {
      onDelta: (delta: { content?: string }) => void;
      signal?: AbortSignal;
    }
  ) => Promise<LlmCompletionResult>;
}

/**
 * Input for a normalized stream of one renderer-owned completion step.
 */
export interface HubChatStreamInput extends HubChatStepInput {
  /**
   * Stable renderer turn identifier supplied by the desktop.
   */
  turnId: string;

  /**
   * Renderer outer-loop step index supplied by the desktop.
   */
  stepIndex: number;

  /**
   * Receives normalized events in their execution order.
   */
  onEvent: (event: AiChatStreamEvent) => void;

  /**
   * Cancels provider work after a downstream disconnect.
   */
  signal?: AbortSignal;
}

/**
 * Sums token usage across multiple provider completions.
 *
 * @param current - Accumulated usage so far.
 * @param next - Usage from the latest completion.
 */
function addUsage(current: LlmCompletionUsage, next: LlmCompletionUsage): LlmCompletionUsage {
  return {
    promptTokens: current.promptTokens + next.promptTokens,
    completionTokens: current.completionTokens + next.completionTokens,
    totalTokens: current.totalTokens + next.totalTokens
  };
}

/**
 * Parses tool call arguments from the provider into a JSON value.
 *
 * @param raw - Raw arguments string from the model.
 */
function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

/**
 * Limits a tool result to the stream contract's UI-safe summary length.
 *
 * @param result - Raw Hub tool result, which may contain large documents.
 * @returns Compact result summary suitable for a progress row.
 */
function summarizeToolResult(result: string): string {
  const maximumLength = 2048;
  return result.length <= maximumLength ? result : `${result.slice(0, maximumLength - 1)}…`;
}

/**
 * Returns a useful continuation response when Hub-owned work reaches its nested limit.
 *
 * @returns Assistant content explaining that the caller can continue the turn.
 */
function innerIterationLimitContent(): string {
  return 'I reached the Team Hub tool-iteration limit. Please continue this request to let me finish.';
}

/**
 * Runs one hub chat step, executing hub-native and hub MCP tools server-side until a
 * client tool call or final text response is reached.
 *
 * @param config - Hub LLM configuration including optional MCP servers.
 * @param input - Model, messages, system prompt, and client tools.
 * @param deps - Optional overrides for completion and tool helpers (tests).
 * @param docsConfig - Optional docs search configuration from server.yaml.
 */
export async function runHubChatStep(
  config: LlmConfig,
  input: HubChatStepInput,
  deps: Partial<HubChatStepDeps> = {},
  docsConfig: DocsConfig | null = null
): Promise<HubChatStepResult> {
  const runCompletion = deps.runCompletion ?? runLlmCompletion;
  const ensureConnections = deps.ensureConnections ?? ensureHubMcpConnections;
  const listTools = deps.listTools ?? listHubMcpTools;
  const callTool = deps.callTool ?? callHubMcpTool;
  const callNativeTool = deps.callNativeTool ?? callHubNativeTool;

  await ensureConnections(config);

  const hubTools = listTools();
  const clientTools = filterClientToolsForHub(input.tools, config, docsConfig);
  const mergedTools: LlmToolDefinition[] | undefined =
    hubTools.length > 0 || (clientTools?.length ?? 0) > 0
      ? [...hubTools, ...(clientTools ?? [])]
      : undefined;

  let messages = [...input.messages];
  let usage: LlmCompletionUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  for (let iteration = 0; iteration < AI_AGENT_MAX_HUB_INNER_ITERATIONS; iteration += 1) {
    const result = await runCompletion(config, {
      model: input.model,
      messages,
      systemPrompt: input.systemPrompt,
      tools: mergedTools
    });

    usage = addUsage(usage, result.usage);

    const toolCalls = result.toolCalls ?? [];
    if (toolCalls.length === 0) {
      return {
        content: result.content,
        usage
      };
    }

    const nativeCalls = toolCalls.filter((call) => isHubNativeToolName(call.name));
    const hubCalls = toolCalls.filter((call) => isHubMcpToolName(call.name));
    const passthroughCalls = toolCalls.filter(
      (call) => !isHubNativeToolName(call.name) && !isHubMcpToolName(call.name)
    );

    if (passthroughCalls.length > 0) {
      return {
        content: result.content,
        toolCalls: passthroughCalls,
        usage
      };
    }

    const serverCalls = [...nativeCalls, ...hubCalls];

    messages = [
      ...messages,
      {
        role: 'assistant',
        content: result.content,
        tool_calls: serverCalls
      }
    ];

    for (const call of nativeCalls) {
      const toolResult = await callNativeTool(
        call.name as HubNativeToolName,
        parseToolArguments(call.arguments),
        config,
        docsConfig
      );
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: toolResult
      });
    }

    for (const call of hubCalls) {
      const toolResult = await callTool(call.name, parseToolArguments(call.arguments));
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: toolResult
      });
    }
  }

  return {
    content: innerIterationLimitContent(),
    usage,
    iteration: { hitIterationLimit: true, boundary: 'hub_inner' }
  };
}

/**
 * Runs one Hub agent step while streaming provider text and Hub tool progress.
 *
 * Harbor-owned calls, including `ask_user`, remain passthrough calls and are
 * never executed here. On a mixed completion, passthrough calls win so Hub
 * calls from that completion are deliberately left untouched.
 *
 * @param config - Hub LLM configuration including optional MCP servers.
 * @param input - Renderer stream context and stateless chat-step input.
 * @param deps - Optional overrides for completion and tool helpers (tests).
 * @param docsConfig - Optional docs search configuration from server.yaml.
 * @returns Final step result after Hub-owned inner iterations.
 */
export async function runHubChatStepStream(
  config: LlmConfig,
  input: HubChatStreamInput,
  deps: Partial<HubChatStepDeps> = {},
  docsConfig: DocsConfig | null = null
): Promise<HubChatStepResult> {
  const runCompletionStream = deps.runCompletionStream ?? runLlmCompletionStream;
  const ensureConnections = deps.ensureConnections ?? ensureHubMcpConnections;
  const listTools = deps.listTools ?? listHubMcpTools;
  const callTool = deps.callTool ?? callHubMcpTool;
  const callNativeTool = deps.callNativeTool ?? callHubNativeTool;

  await ensureConnections(config);

  const hubTools = listTools();
  const clientTools = filterClientToolsForHub(input.tools, config, docsConfig);
  const mergedTools: LlmToolDefinition[] | undefined =
    hubTools.length > 0 || (clientTools?.length ?? 0) > 0
      ? [...hubTools, ...(clientTools ?? [])]
      : undefined;
  let messages = [...input.messages];
  let usage: LlmCompletionUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  input.onEvent({
    v: AI_CHAT_STREAM_EVENT_VERSION,
    type: 'step.start',
    turnId: input.turnId,
    stepIndex: input.stepIndex
  });

  for (let iteration = 0; iteration < AI_AGENT_MAX_HUB_INNER_ITERATIONS; iteration += 1) {
    const result = await runCompletionStream(
      config,
      {
        model: input.model,
        messages,
        systemPrompt: input.systemPrompt,
        tools: mergedTools
      },
      {
        signal: input.signal,
        onDelta: (delta) => {
          if (!delta.content) {
            return;
          }
          input.onEvent({
            v: AI_CHAT_STREAM_EVENT_VERSION,
            type: 'delta.text',
            turnId: input.turnId,
            stepIndex: input.stepIndex,
            chunk: delta.content
          });
        }
      }
    );
    usage = addUsage(usage, result.usage);

    const toolCalls = result.toolCalls ?? [];
    if (toolCalls.length === 0) {
      const finalResult = { content: result.content, usage };
      input.onEvent({
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'step.end',
        turnId: input.turnId,
        stepIndex: input.stepIndex,
        content: finalResult.content,
        usage: finalResult.usage
      });
      return finalResult;
    }

    const nativeCalls = toolCalls.filter((call) => isHubNativeToolName(call.name));
    const hubCalls = toolCalls.filter((call) => isHubMcpToolName(call.name));
    const passthroughCalls = toolCalls.filter(
      (call) => !isHubNativeToolName(call.name) && !isHubMcpToolName(call.name)
    );
    if (passthroughCalls.length > 0) {
      for (const call of passthroughCalls) {
        input.onEvent({
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'tool.call',
          turnId: input.turnId,
          stepIndex: input.stepIndex,
          callId: call.id,
          name: call.name,
          owner: 'harbor',
          arguments: call.arguments
        });
      }
      const finalResult = { content: result.content, toolCalls: passthroughCalls, usage };
      input.onEvent({
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'step.end',
        turnId: input.turnId,
        stepIndex: input.stepIndex,
        content: finalResult.content,
        toolCalls: finalResult.toolCalls,
        usage: finalResult.usage
      });
      return finalResult;
    }

    const serverCalls = [...nativeCalls, ...hubCalls];
    messages = [
      ...messages,
      { role: 'assistant', content: result.content, tool_calls: serverCalls }
    ];

    for (const call of nativeCalls) {
      input.onEvent({
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'tool.call',
        turnId: input.turnId,
        stepIndex: input.stepIndex,
        callId: call.id,
        name: call.name,
        owner: 'hub',
        arguments: call.arguments
      });
      const toolResult = await callNativeTool(
        call.name as HubNativeToolName,
        parseToolArguments(call.arguments),
        config,
        docsConfig
      );
      messages.push({ role: 'tool', tool_call_id: call.id, content: toolResult });
      input.onEvent({
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'tool.result',
        turnId: input.turnId,
        stepIndex: input.stepIndex,
        callId: call.id,
        name: call.name,
        owner: 'hub',
        summary: summarizeToolResult(toolResult),
        ok: true
      });
    }

    for (const call of hubCalls) {
      input.onEvent({
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'tool.call',
        turnId: input.turnId,
        stepIndex: input.stepIndex,
        callId: call.id,
        name: call.name,
        owner: 'hub',
        arguments: call.arguments
      });
      const toolResult = await callTool(call.name, parseToolArguments(call.arguments));
      messages.push({ role: 'tool', tool_call_id: call.id, content: toolResult });
      input.onEvent({
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'tool.result',
        turnId: input.turnId,
        stepIndex: input.stepIndex,
        callId: call.id,
        name: call.name,
        owner: 'hub',
        summary: summarizeToolResult(toolResult),
        ok: true
      });
    }
  }

  const finalResult = {
    content: innerIterationLimitContent(),
    usage,
    iteration: { hitIterationLimit: true, boundary: 'hub_inner' as const }
  };
  input.onEvent({
    v: AI_CHAT_STREAM_EVENT_VERSION,
    type: 'step.end',
    turnId: input.turnId,
    stepIndex: input.stepIndex,
    content: finalResult.content,
    usage: finalResult.usage,
    iteration: finalResult.iteration
  });
  return finalResult;
}
