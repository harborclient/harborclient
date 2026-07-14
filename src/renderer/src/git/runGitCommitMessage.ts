import { resolveAiModelOption } from '#/shared/ai/models';
import {
  buildGitCommitMessageMessages,
  normalizeGitCommitMessage
} from '#/shared/ai/gitCommitMessage';
import type { AiSettings, ChatStepMessage, HubLlmModelGroup } from '#/shared/types';
import { executeAiToolCall } from '#/renderer/src/store/ai/aiToolExecutor';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { persistGitCommitMessageModelId } from '#/renderer/src/git/gitCommitMessageModel';

/**
 * Maximum number of LLM/tool iterations for commit message generation.
 */
const MAX_TOOL_ITERATIONS = 6;

interface RunGitCommitMessageParams {
  /**
   * Collection uuid passed to git_diff.
   */
  collectionUuid: string;

  /**
   * Display name of the git connection shown in the prompt.
   */
  connectionName: string;

  /**
   * Selected model id for the completion request.
   */
  modelId: string;

  /**
   * AI provider settings for hub resolution.
   */
  aiSettings: AiSettings;

  /**
   * Team Hub model groups for hub-proxied models.
   */
  hubModelGroups: HubLlmModelGroup[];

  /**
   * Whether GitHub Models sign-in is active.
   */
  githubConnected?: boolean;

  /**
   * Redux dispatch used by the shared AI tool executor.
   */
  dispatch: AppDispatch;

  /**
   * Reads the current Redux root state for tool execution.
   */
  getState: () => RootState;

  /**
   * Optional request id for cancellation.
   */
  stepRequestId?: string;

  /**
   * Returns true when the user cancelled generation.
   */
  isCancelled?: () => boolean;
}

/**
 * Runs an ephemeral commit-message agent loop: git_diff, then a single subject line.
 *
 * @param params - Collection context, model selection, tool executor context, and cancellation hooks.
 * @returns Normalized commit subject, or null when cancelled or the model returned nothing usable.
 */
export async function runGitCommitMessage({
  collectionUuid,
  connectionName,
  modelId,
  aiSettings,
  hubModelGroups,
  githubConnected = false,
  dispatch,
  getState,
  stepRequestId,
  isCancelled
}: RunGitCommitMessageParams): Promise<string | null> {
  const selectedModelOption = resolveAiModelOption(
    modelId,
    aiSettings,
    hubModelGroups,
    githubConnected
  );
  const messages: ChatStepMessage[] = buildGitCommitMessageMessages(connectionName, collectionUuid);
  let assistantText: string | null = null;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    if (isCancelled?.()) {
      return null;
    }

    const requestId = stepRequestId ?? crypto.randomUUID();

    let step;
    try {
      step = await window.api.completeChatStep(
        {
          model: modelId,
          messages,
          agentVariant: 'commitMessage',
          ...(selectedModelOption?.source === 'hub' ? { hubId: selectedModelOption.hubId } : {})
        },
        requestId
      );
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return null;
      }
      throw error;
    }

    if (isCancelled?.()) {
      return null;
    }

    if (step.toolCalls && step.toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: step.content,
        tool_calls: step.toolCalls
      });

      for (const call of step.toolCalls) {
        if (isCancelled?.()) {
          return null;
        }

        if (call.name !== 'git_diff') {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Tool "${call.name}" is not available in this step.` })
          });
          continue;
        }

        const result = await executeAiToolCall(call.name, call.arguments, {
          getState,
          dispatch
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result
        });
      }

      continue;
    }

    assistantText = step.content;
    break;
  }

  if (isCancelled?.()) {
    return null;
  }

  if (!assistantText?.trim()) {
    return null;
  }

  const normalized = normalizeGitCommitMessage(assistantText);
  if (!normalized) {
    return null;
  }

  persistGitCommitMessageModelId(modelId);
  return normalized;
}
