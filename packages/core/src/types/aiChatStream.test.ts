import { describe, expect, it } from 'vitest';
import {
  AI_AGENT_MAX_HUB_INNER_ITERATIONS,
  AI_AGENT_MAX_RENDERER_STEP_ITERATIONS,
  AI_CHAT_STREAM_EVENT_VERSION,
  PENDING_AI_CHAT_TURN_VERSION,
  chatStepResultFromStepEnd,
  isAiChatStreamEvent,
  isAiChatStreamRendererMessage,
  isPendingAiChatTurn,
  parseAiChatStreamEvent,
  type AiChatStreamEvent,
  type AiChatStreamStepEndEvent,
  type PendingAiChatTurn
} from './aiChatStream';

const TURN_ID = 'turn-abc-123';

/**
 * Builds a minimal valid event envelope for tests.
 *
 * @param type - Event discriminant under test.
 * @param payload - Event-specific fields.
 */
function baseEvent<T extends AiChatStreamEvent['type']>(
  type: T,
  payload: Omit<Extract<AiChatStreamEvent, { type: T }>, 'v' | 'type' | 'turnId'>
): Extract<AiChatStreamEvent, { type: T }> {
  return {
    v: AI_CHAT_STREAM_EVENT_VERSION,
    type,
    turnId: TURN_ID,
    ...payload
  } as Extract<AiChatStreamEvent, { type: T }>;
}

describe('AI agent iteration constants', () => {
  it('exports nested renderer and hub limits of 8', () => {
    expect(AI_AGENT_MAX_RENDERER_STEP_ITERATIONS).toBe(8);
    expect(AI_AGENT_MAX_HUB_INNER_ITERATIONS).toBe(8);
  });
});

describe('isAiChatStreamEvent', () => {
  it('accepts every required event variant', () => {
    const events: AiChatStreamEvent[] = [
      baseEvent('turn.start', { model: 'gpt-4.1' }),
      baseEvent('turn.start', { model: 'claude-sonnet', hubId: 'hub-1' }),
      baseEvent('step.start', { stepIndex: 0 }),
      baseEvent('delta.text', { stepIndex: 1, chunk: 'Hello' }),
      baseEvent('delta.thought', { stepIndex: 1, chunk: 'Planning' }),
      baseEvent('tool.call', {
        stepIndex: 2,
        callId: 'call-1',
        name: 'read_file',
        owner: 'harbor',
        arguments: '{"path":"a.ts"}'
      }),
      baseEvent('tool.result', {
        stepIndex: 2,
        callId: 'call-1',
        name: 'read_file',
        owner: 'renderer',
        summary: 'Read 12 lines',
        ok: true
      }),
      baseEvent('step.end', {
        stepIndex: 2,
        content: 'Done',
        toolCalls: [{ id: 'call-2', name: 'ask_user', arguments: '{"question":"Go?"}' }],
        usage: { totalTokens: 42 },
        iteration: { hitIterationLimit: true, boundary: 'hub_inner' }
      }),
      baseEvent('turn.awaiting_user', {
        toolCallId: 'call-ask',
        question: 'Continue?',
        choices: ['Yes', 'No']
      }),
      baseEvent('turn.end', { content: 'All finished', usage: { promptTokens: 10 } }),
      baseEvent('turn.error', { message: 'Provider unavailable' }),
      baseEvent('turn.cancelled', {})
    ];

    for (const event of events) {
      expect(isAiChatStreamEvent(event), event.type).toBe(true);
    }
  });

  it('rejects unknown versions and malformed discriminants', () => {
    expect(isAiChatStreamEvent({ v: 2, type: 'turn.start', turnId: TURN_ID, model: 'x' })).toBe(
      false
    );
    expect(isAiChatStreamEvent({ v: 1, type: 'turn.progress', turnId: TURN_ID })).toBe(false);
    expect(isAiChatStreamEvent(null)).toBe(false);
    expect(isAiChatStreamEvent('not-json')).toBe(false);
    expect(isAiChatStreamEvent([])).toBe(false);
  });

  it('rejects step events without stepIndex and invalid nested tool calls', () => {
    expect(
      isAiChatStreamEvent({
        v: 1,
        type: 'step.end',
        turnId: TURN_ID,
        content: null,
        toolCalls: [{ id: '', name: 'bad', arguments: '{}' }]
      })
    ).toBe(false);

    expect(
      isAiChatStreamEvent({
        v: 1,
        type: 'delta.text',
        turnId: TURN_ID,
        chunk: 'hello'
      })
    ).toBe(false);
  });

  it('rejects empty delta chunks and oversized tool summaries', () => {
    expect(
      isAiChatStreamEvent({
        v: 1,
        type: 'delta.text',
        turnId: TURN_ID,
        stepIndex: 0,
        chunk: ''
      })
    ).toBe(false);

    expect(
      isAiChatStreamEvent({
        v: 1,
        type: 'tool.result',
        turnId: TURN_ID,
        stepIndex: 0,
        callId: 'call-1',
        name: 'tool',
        owner: 'hub',
        summary: 'x'.repeat(3000)
      })
    ).toBe(false);
  });
});

describe('isAiChatStreamRendererMessage', () => {
  it('accepts chat-correlated stream payloads', () => {
    expect(
      isAiChatStreamRendererMessage({
        chatId: 4,
        event: baseEvent('turn.end', {})
      })
    ).toBe(true);
  });

  it('rejects malformed chat ids and invalid nested events', () => {
    expect(
      isAiChatStreamRendererMessage({
        chatId: 0,
        event: baseEvent('turn.end', {})
      })
    ).toBe(false);
    expect(
      isAiChatStreamRendererMessage({
        chatId: 4,
        event: { v: 2, type: 'turn.end', turnId: TURN_ID }
      })
    ).toBe(false);
    expect(isAiChatStreamRendererMessage(null)).toBe(false);
  });
});

describe('parseAiChatStreamEvent', () => {
  it('parses valid JSON payloads', () => {
    const event = baseEvent('turn.cancelled', {});
    expect(parseAiChatStreamEvent(JSON.stringify(event))).toEqual(event);
  });

  it('returns null for invalid JSON and invalid payloads', () => {
    expect(parseAiChatStreamEvent('{not-json')).toBeNull();
    expect(
      parseAiChatStreamEvent(JSON.stringify({ v: 1, type: 'turn.end', turnId: '' }))
    ).toBeNull();
  });
});

describe('chatStepResultFromStepEnd', () => {
  it('reconstructs ChatStepResult without treating a hub step as a whole turn', () => {
    const stepEnd = baseEvent('step.end', {
      stepIndex: 3,
      content: null,
      toolCalls: [{ id: 'call-1', name: 'grep', arguments: '{"pattern":"foo"}' }]
    }) as AiChatStreamStepEndEvent;

    expect(chatStepResultFromStepEnd(stepEnd)).toEqual({
      content: null,
      toolCalls: [{ id: 'call-1', name: 'grep', arguments: '{"pattern":"foo"}' }]
    });
  });

  it('omits empty toolCalls arrays from the backward-compatible result', () => {
    const stepEnd = baseEvent('step.end', {
      stepIndex: 0,
      content: 'hello',
      toolCalls: []
    }) as AiChatStreamStepEndEvent;

    expect(chatStepResultFromStepEnd(stepEnd)).toEqual({ content: 'hello' });
  });

  it('retains an exhausted Hub inner-loop boundary for the renderer', () => {
    const stepEnd = baseEvent('step.end', {
      stepIndex: 0,
      content: 'Continue this request.',
      iteration: { hitIterationLimit: true, boundary: 'hub_inner' }
    }) as AiChatStreamStepEndEvent;

    expect(stepEnd.iteration).toEqual({ hitIterationLimit: true, boundary: 'hub_inner' });
    expect(chatStepResultFromStepEnd(stepEnd)).toEqual({
      content: 'Continue this request.',
      iteration: { hitIterationLimit: true, boundary: 'hub_inner' }
    });
  });
});

describe('isPendingAiChatTurn', () => {
  it('accepts a versioned recovery payload with full step messages', () => {
    const pending: PendingAiChatTurn = {
      v: PENDING_AI_CHAT_TURN_VERSION,
      chatId: 7,
      turnId: TURN_ID,
      model: 'gpt-4.1',
      hubId: 'hub-1',
      messages: [
        { role: 'user', content: 'Help me' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call-ask', name: 'ask_user', arguments: '{"question":"Go?"}' }]
        }
      ],
      toolCallId: 'call-ask',
      question: 'Go?',
      choices: ['Yes', 'No'],
      rendererStepCount: 2,
      toolCallCount: 1,
      hubInnerStepCount: 1,
      userContent: 'Help me',
      updatedAt: '2026-08-09T12:00:00.000Z'
    };

    expect(isPendingAiChatTurn(pending)).toBe(true);
  });

  it('rejects malformed recovery payloads', () => {
    expect(isPendingAiChatTurn({ v: 2, chatId: 1 })).toBe(false);
    expect(
      isPendingAiChatTurn({
        v: PENDING_AI_CHAT_TURN_VERSION,
        chatId: 1,
        turnId: TURN_ID,
        model: 'gpt-4.1',
        messages: [{ role: 'assistant', tool_calls: [{ id: 'x', name: 'bad', arguments: 1 }] }],
        toolCallId: 'call-1',
        question: 'Q?',
        rendererStepCount: 0,
        toolCallCount: 0,
        updatedAt: '2026-08-09T12:00:00.000Z'
      })
    ).toBe(false);
  });
});
