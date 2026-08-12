import { describe, expect, it, vi } from 'vitest';
import type { LlmConfig } from '#/config/llmConfig.js';
import { runHubChatStep, runHubChatStepStream, type HubChatStepDeps } from '#/server/llm/agent.js';
import { AI_AGENT_MAX_HUB_INNER_ITERATIONS } from '#/server/llm/aiChatStreamContract.js';
import type { LlmCompletionResult } from '#/server/llm/client.js';
import { encodeHubMcpToolName } from '#/server/llm/hubMcpToolNames.js';
import type { HubMcpOpenAiTool } from '#/server/llm/mcpClient.js';

const sampleConfig: LlmConfig = {
  providers: { openai: { apiKey: 'sk-test' } },
  models: ['gpt-4o'],
  mcp: [{ name: 'Exa', url: 'https://mcp.exa.ai/mcp', headers: [] }]
};

/**
 * Builds fake hub chat step dependencies for agent loop tests.
 *
 * @param completionResults - Provider completions returned in order.
 * @param callTool - Optional MCP tool executor override.
 */
function createDeps(
  completionResults: LlmCompletionResult[],
  callTool?: HubChatStepDeps['callTool']
): HubChatStepDeps {
  const runCompletion = vi.fn(async () => {
    const next = completionResults.shift();
    if (!next) {
      throw new Error('No more fake completion results.');
    }
    return next;
  });

  return {
    runCompletion,
    ensureConnections: vi.fn(async () => undefined),
    listTools: vi.fn((): HubMcpOpenAiTool[] => [
      {
        type: 'function',
        function: {
          name: encodeHubMcpToolName(0, 'search'),
          description: 'Search the web',
          parameters: { type: 'object', properties: {} }
        }
      }
    ]),
    callTool: callTool ?? vi.fn(async () => JSON.stringify({ results: [{ title: 'Example' }] })),
    callNativeTool: vi.fn(async () =>
      JSON.stringify([{ title: 'Features', url: 'https://harborclient.com/features' }])
    )
  };
}

describe('runHubChatStep', () => {
  it('loops on hub MCP tool calls and returns final text with summed usage', async () => {
    const deps = createDeps([
      {
        content: null,
        toolCalls: [{ id: 'call-1', name: encodeHubMcpToolName(0, 'search'), arguments: '{}' }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      },
      {
        content: 'Found results.',
        usage: { promptTokens: 20, completionTokens: 8, totalTokens: 28 }
      }
    ]);

    const result = await runHubChatStep(
      sampleConfig,
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Search for harborclient' }]
      },
      deps
    );

    expect(result.content).toBe('Found results.');
    expect(result.toolCalls).toBeUndefined();
    expect(result.usage).toEqual({
      promptTokens: 30,
      completionTokens: 13,
      totalTokens: 43
    });
    expect(deps.runCompletion).toHaveBeenCalledTimes(2);
    expect(deps.callTool).toHaveBeenCalledOnce();
  });

  it('returns passthrough tool calls immediately', async () => {
    const deps = createDeps([
      {
        content: null,
        toolCalls: [{ id: 'call-1', name: 'listCollections', arguments: '{}' }],
        usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 }
      }
    ]);

    const result = await runHubChatStep(
      sampleConfig,
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'List collections' }]
      },
      deps
    );

    expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'listCollections', arguments: '{}' }]);
    expect(deps.callTool).not.toHaveBeenCalled();
  });

  it('returns only passthrough tool calls on a mixed turn', async () => {
    const deps = createDeps([
      {
        content: null,
        toolCalls: [
          { id: 'call-1', name: encodeHubMcpToolName(0, 'search'), arguments: '{}' },
          { id: 'call-2', name: 'listCollections', arguments: '{}' }
        ],
        usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 }
      }
    ]);

    const result = await runHubChatStep(
      sampleConfig,
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Do both' }]
      },
      deps
    );

    expect(result.toolCalls).toEqual([{ id: 'call-2', name: 'listCollections', arguments: '{}' }]);
    expect(deps.callTool).not.toHaveBeenCalled();
  });

  it('loops on hub-native search_docs and returns final text with summed usage', async () => {
    const deps = createDeps([
      {
        content: null,
        toolCalls: [{ id: 'call-1', name: 'search_docs', arguments: '{"query":"features"}' }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      },
      {
        content: 'HarborClient supports collections.',
        usage: { promptTokens: 20, completionTokens: 8, totalTokens: 28 }
      }
    ]);

    const result = await runHubChatStep(
      sampleConfig,
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'What features does HarborClient have?' }]
      },
      deps,
      { searchIndexPath: '/app/data/docsSearchIndex.json' }
    );

    expect(result.content).toBe('HarborClient supports collections.');
    expect(result.toolCalls).toBeUndefined();
    expect(deps.callNativeTool).toHaveBeenCalledOnce();
    expect(deps.callTool).not.toHaveBeenCalled();
  });

  it('stops after the iteration cap', async () => {
    const repeatedMcpTurn: LlmCompletionResult = {
      content: null,
      toolCalls: [{ id: 'call-1', name: encodeHubMcpToolName(0, 'search'), arguments: '{}' }],
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
    };

    const deps = createDeps(
      Array.from({ length: AI_AGENT_MAX_HUB_INNER_ITERATIONS }, () => repeatedMcpTurn)
    );

    const result = await runHubChatStep(
      sampleConfig,
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Loop forever' }]
      },
      deps
    );

    expect(result.content).toContain('Team Hub tool-iteration limit');
    expect(result.toolCalls).toBeUndefined();
    expect(result.iteration).toEqual({ hitIterationLimit: true, boundary: 'hub_inner' });
    expect(deps.runCompletion).toHaveBeenCalledTimes(AI_AGENT_MAX_HUB_INNER_ITERATIONS);
    expect(deps.callTool).toHaveBeenCalledTimes(AI_AGENT_MAX_HUB_INNER_ITERATIONS);
    expect(result.usage.totalTokens).toBe(AI_AGENT_MAX_HUB_INNER_ITERATIONS * 2);
  });

  it('returns iteration-limit continuation when exhausted with assistant text on every tool turn', async () => {
    const repeatedMcpTurnWithText: LlmCompletionResult = {
      content: 'Still searching…',
      toolCalls: [{ id: 'call-1', name: encodeHubMcpToolName(0, 'search'), arguments: '{}' }],
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 }
    };

    const deps = createDeps(
      Array.from({ length: AI_AGENT_MAX_HUB_INNER_ITERATIONS }, () => repeatedMcpTurnWithText)
    );

    const result = await runHubChatStep(
      sampleConfig,
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Loop forever with narration' }]
      },
      deps
    );

    expect(result.content).toContain('Team Hub tool-iteration limit');
    expect(result.content).not.toContain('Still searching');
    expect(result.toolCalls).toBeUndefined();
    expect(result.iteration).toEqual({ hitIterationLimit: true, boundary: 'hub_inner' });
    expect(deps.runCompletion).toHaveBeenCalledTimes(AI_AGENT_MAX_HUB_INNER_ITERATIONS);
    expect(deps.callTool).toHaveBeenCalledTimes(AI_AGENT_MAX_HUB_INNER_ITERATIONS);
    expect(result.usage).toEqual({
      promptTokens: AI_AGENT_MAX_HUB_INNER_ITERATIONS * 3,
      completionTokens: AI_AGENT_MAX_HUB_INNER_ITERATIONS * 2,
      totalTokens: AI_AGENT_MAX_HUB_INNER_ITERATIONS * 5
    });
  });

  it('streams Hub tool progress and returns Harbor calls at the boundary', async () => {
    const deps = createDeps([]);
    deps.runCompletionStream = vi
      .fn()
      .mockImplementationOnce(async (_config, _input, options) => {
        options.onDelta({ content: 'Looking up ' });
        options.onDelta({ content: 'documentation.' });
        return {
          content: null,
          toolCalls: [{ id: 'hub-1', name: 'search_docs', arguments: '{"query":"tools"}' }],
          usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
        };
      })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ id: 'harbor-1', name: 'ask_user', arguments: '{"question":"Continue?"}' }],
        usage: { promptTokens: 4, completionTokens: 5, totalTokens: 9 }
      });
    const events: unknown[] = [];

    const result = await runHubChatStepStream(
      sampleConfig,
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Find tools' }],
        turnId: 'turn-1',
        stepIndex: 0,
        onEvent: (event) => events.push(event)
      },
      deps,
      { searchIndexPath: '/app/data/docsSearchIndex.json' }
    );

    expect(result.toolCalls).toEqual([
      { id: 'harbor-1', name: 'ask_user', arguments: '{"question":"Continue?"}' }
    ]);
    expect(deps.callNativeTool).toHaveBeenCalledOnce();
    expect(deps.callTool).not.toHaveBeenCalled();
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.start' }),
        expect.objectContaining({ type: 'delta.text', chunk: 'Looking up ' }),
        expect.objectContaining({ type: 'tool.call', callId: 'hub-1', owner: 'hub' }),
        expect.objectContaining({ type: 'tool.result', callId: 'hub-1', owner: 'hub' }),
        expect.objectContaining({ type: 'tool.call', callId: 'harbor-1', owner: 'harbor' }),
        expect.objectContaining({ type: 'step.end', toolCalls: result.toolCalls })
      ])
    );
  });
});
