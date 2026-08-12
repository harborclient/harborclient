import type { ChatStepMessage, ChatStepResult, ChatToolCall } from './ai';

/**
 * IPC channel name for normalized AI chat stream events pushed to the renderer.
 */
export const AI_CHAT_STREAM_IPC_CHANNEL = 'aiChat:stream' as const;

/**
 * Wire format version for AI chat stream events.
 */
export const AI_CHAT_STREAM_EVENT_VERSION = 1 as const;

/**
 * Wire format version for persisted pending-turn recovery payloads.
 */
export const PENDING_AI_CHAT_TURN_VERSION = 1 as const;

/**
 * Maximum renderer outer-loop `completeChatStep` invokes per user message.
 *
 * Nested with {@link AI_AGENT_MAX_HUB_INNER_ITERATIONS}: worst case provider
 * steps per user message is outer × inner, not a single combined cap.
 */
export const AI_AGENT_MAX_RENDERER_STEP_ITERATIONS = 8;

/**
 * Maximum Team Hub inner agent-loop iterations per renderer `completeChatStep`
 * invoke.
 *
 * Each renderer outer step may trigger up to this many hub-native provider +
 * tool iterations before returning passthrough tool calls or final text.
 */
export const AI_AGENT_MAX_HUB_INNER_ITERATIONS = 8;

/**
 * Upper bound for UI-safe `tool.result` summaries on the wire.
 */
export const AI_CHAT_STREAM_TOOL_RESULT_SUMMARY_MAX_LENGTH = 2048;

/**
 * Upper bound for a single text or thought delta chunk on the wire.
 */
export const AI_CHAT_STREAM_DELTA_CHUNK_MAX_LENGTH = 65_536;

/**
 * Semantic kinds for normalized AI chat stream events.
 */
export type AiChatStreamEventType =
  | 'turn.start'
  | 'step.start'
  | 'delta.text'
  | 'delta.thought'
  | 'tool.call'
  | 'tool.result'
  | 'step.end'
  | 'turn.awaiting_user'
  | 'turn.end'
  | 'turn.error'
  | 'turn.cancelled';

/**
 * Which runtime owns execution for a streamed tool call or result.
 */
export type AiChatStreamToolOwner = 'harbor' | 'hub' | 'renderer';

/**
 * Optional token usage metadata attached to step or turn completion events.
 */
export interface AiChatStreamUsage {
  /**
   * Prompt/input tokens when reported by the provider.
   */
  promptTokens?: number;

  /**
   * Completion/output tokens when reported by the provider.
   */
  completionTokens?: number;

  /**
   * Total tokens when reported by the provider.
   */
  totalTokens?: number;
}

/**
 * Optional iteration-limit metadata for a completed step.
 */
export interface AiChatStreamIterationMeta {
  /**
   * Whether the step ended because an iteration limit was reached.
   */
  hitIterationLimit?: boolean;

  /**
   * Which nested loop boundary was exhausted.
   */
  boundary?: 'renderer_outer' | 'hub_inner';
}

/**
 * Shared envelope fields present on every stream event.
 */
interface AiChatStreamEventBase {
  /**
   * Payload schema version for forward-compatible clients.
   */
  v: typeof AI_CHAT_STREAM_EVENT_VERSION;

  /**
   * Event discriminant.
   */
  type: AiChatStreamEventType;

  /**
   * Stable turn identifier spanning renderer orchestration for one user send.
   */
  turnId: string;
}

/**
 * Shared fields for events scoped to one renderer outer-loop step.
 */
interface AiChatStreamStepScopedBase extends AiChatStreamEventBase {
  /**
   * Zero-based renderer outer-loop step index for this `completeChatStep` invoke.
   */
  stepIndex: number;
}

/**
 * Renderer-originated turn start metadata.
 */
export interface AiChatStreamTurnStartEvent extends AiChatStreamEventBase {
  type: 'turn.start';
  model: string;
  hubId?: string;
}

/**
 * Marks the beginning of one renderer outer-loop step.
 */
export interface AiChatStreamStepStartEvent extends AiChatStreamStepScopedBase {
  type: 'step.start';
}

/**
 * Incremental assistant text for the active step.
 */
export interface AiChatStreamDeltaTextEvent extends AiChatStreamStepScopedBase {
  type: 'delta.text';
  chunk: string;
}

/**
 * Incremental ephemeral reasoning/thought text for the active step.
 */
export interface AiChatStreamDeltaThoughtEvent extends AiChatStreamStepScopedBase {
  type: 'delta.thought';
  chunk: string;
}

/**
 * Tool call announced at a completion boundary for the active step.
 */
export interface AiChatStreamToolCallEvent extends AiChatStreamStepScopedBase {
  type: 'tool.call';
  callId: string;
  name: string;
  owner: Extract<AiChatStreamToolOwner, 'harbor' | 'hub'>;
  arguments: string;
}

/**
 * Tool result suitable for live UI progress rows.
 */
export interface AiChatStreamToolResultEvent extends AiChatStreamStepScopedBase {
  type: 'tool.result';
  callId: string;
  name: string;
  owner: AiChatStreamToolOwner;
  summary: string;
  ok?: boolean;
}

/**
 * Final backward-compatible payload for one completion step.
 */
export interface AiChatStreamStepEndEvent extends AiChatStreamStepScopedBase {
  type: 'step.end';
  content: string | null;
  toolCalls?: ChatToolCall[];
  usage?: AiChatStreamUsage;
  iteration?: AiChatStreamIterationMeta;
}

/**
 * Turn paused waiting for a user answer to `ask_user`.
 */
export interface AiChatStreamTurnAwaitingUserEvent extends AiChatStreamEventBase {
  type: 'turn.awaiting_user';
  toolCallId: string;
  question: string;
  choices?: string[];
}

/**
 * Terminal successful turn completion emitted by the renderer.
 */
export interface AiChatStreamTurnEndEvent extends AiChatStreamEventBase {
  type: 'turn.end';
  content?: string | null;
  usage?: AiChatStreamUsage;
  iteration?: AiChatStreamIterationMeta;
}

/**
 * Terminal turn failure.
 */
export interface AiChatStreamTurnErrorEvent extends AiChatStreamEventBase {
  type: 'turn.error';
  message: string;
}

/**
 * Terminal turn cancellation.
 */
export interface AiChatStreamTurnCancelledEvent extends AiChatStreamEventBase {
  type: 'turn.cancelled';
}

/**
 * Versioned, JSON-serializable AI chat stream event union.
 */
export type AiChatStreamEvent =
  | AiChatStreamTurnStartEvent
  | AiChatStreamStepStartEvent
  | AiChatStreamDeltaTextEvent
  | AiChatStreamDeltaThoughtEvent
  | AiChatStreamToolCallEvent
  | AiChatStreamToolResultEvent
  | AiChatStreamStepEndEvent
  | AiChatStreamTurnAwaitingUserEvent
  | AiChatStreamTurnEndEvent
  | AiChatStreamTurnErrorEvent
  | AiChatStreamTurnCancelledEvent;

/**
 * IPC payload delivered from main to renderer for one normalized stream event.
 */
export interface AiChatStreamRendererMessage {
  /**
   * Local SQLite chat id used for Redux correlation.
   */
  chatId: number;

  /**
   * Validated normalized stream event without desktop routing fields.
   */
  event: AiChatStreamEvent;
}

/**
 * Desktop execution metadata threaded through IPC and main-process runners.
 *
 * Local `chatId` is required for renderer delivery but must not be embedded in
 * provider-facing `ChatStepInput` messages or Team Hub HTTP payloads.
 */
export interface AiChatStreamContext {
  /**
   * Local SQLite chat id used for IPC routing and Redux correlation.
   */
  chatId: number;

  /**
   * Stable turn identifier for the active renderer orchestration loop.
   */
  turnId: string;

  /**
   * Zero-based renderer outer-loop step index for the current invoke.
   */
  stepIndex: number;
}

/**
 * Versioned crash-recovery payload for a turn paused on `ask_user`.
 */
export interface PendingAiChatTurn {
  /**
   * Payload schema version for forward-compatible persistence.
   */
  v: typeof PENDING_AI_CHAT_TURN_VERSION;

  /**
   * Local chat id owning the paused turn.
   */
  chatId: number;

  /**
   * Stable turn identifier to resume after restart.
   */
  turnId: string;

  /**
   * Model id selected when the turn began.
   */
  model: string;

  /**
   * Team Hub id when the model is hub-proxied.
   */
  hubId?: string;

  /**
   * Full step message history required to resume the tool loop, including
   * `tool_calls` and `tool` rows that ordinary `ChatMessage` persistence drops.
   */
  messages: ChatStepMessage[];

  /**
   * Tool call id for the paused `ask_user` invocation.
   */
  toolCallId: string;

  /**
   * Question text presented to the user.
   */
  question: string;

  /**
   * Optional multiple-choice answers for the paused question.
   */
  choices?: string[];

  /**
   * Renderer outer-loop steps completed before the pause.
   */
  rendererStepCount: number;

  /**
   * Desktop tool calls processed before the turn paused.
   */
  toolCallCount: number;

  /**
   * Hub inner-loop steps completed in the invoke that paused, when applicable.
   */
  hubInnerStepCount?: number;

  /**
   * Original user message content needed by plugin resume hooks.
   */
  userContent?: string;

  /**
   * ISO timestamp when the pending turn was last updated.
   */
  updatedAt: string;
}

const AI_CHAT_STREAM_EVENT_TYPES: ReadonlySet<string> = new Set([
  'turn.start',
  'step.start',
  'delta.text',
  'delta.thought',
  'tool.call',
  'tool.result',
  'step.end',
  'turn.awaiting_user',
  'turn.end',
  'turn.error',
  'turn.cancelled'
]);

const TOOL_CALL_OWNERS: ReadonlySet<string> = new Set(['harbor', 'hub']);
const TOOL_RESULT_OWNERS: ReadonlySet<string> = new Set(['harbor', 'hub', 'renderer']);

/**
 * Returns true when `value` is a finite non-negative integer step index.
 *
 * @param value - Candidate step index.
 */
function isStepIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Returns true when `value` is a non-empty bounded string identifier.
 *
 * @param value - Candidate identifier.
 * @param maxLength - Maximum accepted length.
 */
function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

/**
 * Returns true when `value` is a bounded string, including empty strings.
 *
 * @param value - Candidate string.
 * @param maxLength - Maximum accepted length.
 */
function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

/**
 * Returns true when `value` is a JSON-safe string array of bounded choices.
 *
 * @param value - Candidate choices array.
 */
function isChoiceList(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((choice) => isNonEmptyString(choice, 512));
}

/**
 * Returns true when `value` matches {@link ChatToolCall}.
 *
 * @param value - Candidate tool call object.
 */
function isChatToolCall(value: unknown): value is ChatToolCall {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    isNonEmptyString(record.id, 256) &&
    isNonEmptyString(record.name, 256) &&
    typeof record.arguments === 'string' &&
    record.arguments.length <= 65_536
  );
}

/**
 * Returns true when `value` matches {@link ChatStepMessage}.
 *
 * @param value - Candidate step message object.
 */
function isChatStepMessage(value: unknown): value is ChatStepMessage {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    record.role !== 'system' &&
    record.role !== 'user' &&
    record.role !== 'assistant' &&
    record.role !== 'tool'
  ) {
    return false;
  }

  if (record.content != null && typeof record.content !== 'string') {
    return false;
  }

  if (
    record.content != null &&
    typeof record.content === 'string' &&
    record.content.length > 1_048_576
  ) {
    return false;
  }

  if (record.tool_calls != null) {
    if (!Array.isArray(record.tool_calls) || !record.tool_calls.every(isChatToolCall)) {
      return false;
    }
  }

  if (record.tool_call_id != null && !isNonEmptyString(record.tool_call_id, 256)) {
    return false;
  }

  if (record.name != null && !isNonEmptyString(record.name, 256)) {
    return false;
  }

  return true;
}

/**
 * Returns true when `value` matches {@link AiChatStreamUsage}.
 *
 * @param value - Candidate usage object.
 */
function isAiChatStreamUsage(value: unknown): value is AiChatStreamUsage {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  const numericFields = ['promptTokens', 'completionTokens', 'totalTokens'] as const;

  return numericFields.every((field) => {
    const candidate = record[field];
    return (
      candidate == null ||
      (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0)
    );
  });
}

/**
 * Returns true when `value` matches {@link AiChatStreamIterationMeta}.
 *
 * @param value - Candidate iteration metadata object.
 */
function isAiChatStreamIterationMeta(value: unknown): value is AiChatStreamIterationMeta {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.hitIterationLimit != null && typeof record.hitIterationLimit !== 'boolean') {
    return false;
  }

  if (
    record.boundary != null &&
    record.boundary !== 'renderer_outer' &&
    record.boundary !== 'hub_inner'
  ) {
    return false;
  }

  return true;
}

/**
 * Validates the shared event envelope and returns the record when valid.
 *
 * @param value - Parsed JSON value.
 */
function readEventEnvelope(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.v !== AI_CHAT_STREAM_EVENT_VERSION) {
    return null;
  }

  if (typeof record.type !== 'string' || !AI_CHAT_STREAM_EVENT_TYPES.has(record.type)) {
    return null;
  }

  if (!isNonEmptyString(record.turnId, 128)) {
    return null;
  }

  return record;
}

/**
 * Type guard for main-to-renderer AI chat stream IPC payloads.
 *
 * @param value - Parsed JSON value from IPC delivery.
 * @returns True when `value` matches {@link AiChatStreamRendererMessage}.
 */
export function isAiChatStreamRendererMessage(
  value: unknown
): value is AiChatStreamRendererMessage {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.chatId === 'number' &&
    Number.isInteger(record.chatId) &&
    record.chatId > 0 &&
    isAiChatStreamEvent(record.event)
  );
}

/**
 * Type guard for normalized AI chat stream events.
 *
 * @param value - Parsed JSON value from IPC, SSE, or in-process emitters.
 * @returns True when `value` matches {@link AiChatStreamEvent}.
 */
export function isAiChatStreamEvent(value: unknown): value is AiChatStreamEvent {
  const record = readEventEnvelope(value);
  if (record == null) {
    return false;
  }

  switch (record.type) {
    case 'turn.start':
      return (
        isNonEmptyString(record.model, 256) &&
        (record.hubId == null || isNonEmptyString(record.hubId, 256))
      );
    case 'step.start':
      return isStepIndex(record.stepIndex);
    case 'delta.text':
    case 'delta.thought':
      return (
        isStepIndex(record.stepIndex) &&
        isBoundedString(record.chunk, AI_CHAT_STREAM_DELTA_CHUNK_MAX_LENGTH) &&
        record.chunk.length > 0
      );
    case 'tool.call':
      return (
        isStepIndex(record.stepIndex) &&
        isNonEmptyString(record.callId, 256) &&
        isNonEmptyString(record.name, 256) &&
        typeof record.owner === 'string' &&
        TOOL_CALL_OWNERS.has(record.owner) &&
        typeof record.arguments === 'string' &&
        record.arguments.length <= 65_536
      );
    case 'tool.result':
      return (
        isStepIndex(record.stepIndex) &&
        isNonEmptyString(record.callId, 256) &&
        isNonEmptyString(record.name, 256) &&
        typeof record.owner === 'string' &&
        TOOL_RESULT_OWNERS.has(record.owner) &&
        isBoundedString(record.summary, AI_CHAT_STREAM_TOOL_RESULT_SUMMARY_MAX_LENGTH) &&
        (record.ok == null || typeof record.ok === 'boolean')
      );
    case 'step.end':
      return (
        isStepIndex(record.stepIndex) &&
        (record.content === null || isBoundedString(record.content, 1_048_576)) &&
        (record.toolCalls == null ||
          (Array.isArray(record.toolCalls) && record.toolCalls.every(isChatToolCall))) &&
        (record.usage == null || isAiChatStreamUsage(record.usage)) &&
        (record.iteration == null || isAiChatStreamIterationMeta(record.iteration))
      );
    case 'turn.awaiting_user':
      return (
        isNonEmptyString(record.toolCallId, 256) &&
        isNonEmptyString(record.question, 4_096) &&
        (record.choices == null || isChoiceList(record.choices))
      );
    case 'turn.end':
      return (
        (record.content == null ||
          record.content === undefined ||
          isBoundedString(record.content, 1_048_576)) &&
        (record.usage == null || isAiChatStreamUsage(record.usage)) &&
        (record.iteration == null || isAiChatStreamIterationMeta(record.iteration))
      );
    case 'turn.error':
      return isNonEmptyString(record.message, 4_096);
    case 'turn.cancelled':
      return true;
    default:
      return false;
  }
}

/**
 * Parses a JSON string into a validated {@link AiChatStreamEvent}.
 *
 * @param data - Raw JSON payload from IPC or SSE `data:` frames.
 * @returns Parsed event or null when the payload is malformed or unsupported.
 */
export function parseAiChatStreamEvent(data: string): AiChatStreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (!isAiChatStreamEvent(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Type guard for persisted pending-turn recovery payloads.
 *
 * @param value - Parsed JSON value from SQLite.
 * @returns True when `value` matches {@link PendingAiChatTurn}.
 */
export function isPendingAiChatTurn(value: unknown): value is PendingAiChatTurn {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.v === PENDING_AI_CHAT_TURN_VERSION &&
    typeof record.chatId === 'number' &&
    Number.isInteger(record.chatId) &&
    record.chatId > 0 &&
    isNonEmptyString(record.turnId, 128) &&
    isNonEmptyString(record.model, 256) &&
    (record.hubId == null || isNonEmptyString(record.hubId, 256)) &&
    Array.isArray(record.messages) &&
    record.messages.every(isChatStepMessage) &&
    isNonEmptyString(record.toolCallId, 256) &&
    isNonEmptyString(record.question, 4_096) &&
    (record.choices == null || isChoiceList(record.choices)) &&
    typeof record.rendererStepCount === 'number' &&
    Number.isInteger(record.rendererStepCount) &&
    record.rendererStepCount >= 0 &&
    typeof record.toolCallCount === 'number' &&
    Number.isInteger(record.toolCallCount) &&
    record.toolCallCount >= 0 &&
    (record.hubInnerStepCount == null ||
      (typeof record.hubInnerStepCount === 'number' &&
        Number.isInteger(record.hubInnerStepCount) &&
        record.hubInnerStepCount >= 0)) &&
    (record.userContent == null || isBoundedString(record.userContent, 1_048_576)) &&
    isNonEmptyString(record.updatedAt, 64)
  );
}

/**
 * Reconstructs a backward-compatible {@link ChatStepResult} from `step.end`.
 *
 * @param event - Validated step completion event.
 * @returns Final step payload consumed by the existing renderer tool loop.
 */
export function chatStepResultFromStepEnd(event: AiChatStreamStepEndEvent): ChatStepResult {
  return {
    content: event.content,
    ...(event.toolCalls != null && event.toolCalls.length > 0
      ? { toolCalls: event.toolCalls }
      : {}),
    ...(event.iteration?.hitIterationLimit
      ? {
          iteration: {
            hitIterationLimit: true,
            boundary: event.iteration.boundary ?? 'hub_inner'
          }
        }
      : {})
  };
}
