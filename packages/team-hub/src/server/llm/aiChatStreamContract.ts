/**
 * Re-exports the canonical AI chat stream contract from `@harborclient/core`.
 */
export {
  AI_AGENT_MAX_HUB_INNER_ITERATIONS,
  AI_AGENT_MAX_RENDERER_STEP_ITERATIONS,
  AI_CHAT_STREAM_EVENT_VERSION,
  chatStepResultFromStepEnd,
  isAiChatStreamEvent,
  parseAiChatStreamEvent,
  type AiChatStreamEvent
} from '@harborclient/core/types/aiChatStream';
