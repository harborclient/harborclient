import toast from 'react-hot-toast';
import { resolveAiModelOption } from '#/shared/ai/models';
import {
  appendScriptAskThinking,
  applyScriptAskAtLine,
  parseScriptAskResult,
  stripScriptAskThinking
} from '#/shared/ai/scriptAsk';
import type { AiSettings, HubLlmModelGroup } from '#/shared/types';
import { persistScriptAskModelId } from '#/renderer/src/scripting/scriptAskModel';

interface RunScriptAskParams {
  /**
   * Script source at the time the ask was triggered.
   */
  code: string;

  /**
   * 1-based line number of the `/ask` command.
   */
  line: number;

  /**
   * Script phase for the mini-agent system prompt.
   */
  phase: 'pre' | 'post';

  /**
   * User question sent to the model.
   */
  question: string;

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
   * Applies updated script source after thinking, success, or error recovery.
   */
  onCodeChange: (code: string) => void;

  /**
   * Optional request id for cancellation (modal Stop button).
   */
  stepRequestId?: string;

  /**
   * When true, appends " Thinking..." to the `/ask` line in the editor.
   */
  showThinkingInEditor?: boolean;
}

/**
 * Runs a single-shot script `/ask` request: optional inline thinking suffix, API call, line apply.
 *
 * @param params - Script context, model, callbacks, and optional cancellation id.
 */
export async function runScriptAsk({
  code,
  line,
  phase,
  question,
  modelId,
  aiSettings,
  hubModelGroups,
  githubConnected = false,
  onCodeChange,
  stepRequestId,
  showThinkingInEditor = true
}: RunScriptAskParams): Promise<void> {
  const workingCode = showThinkingInEditor ? appendScriptAskThinking(code, line) : code;
  if (showThinkingInEditor) {
    onCodeChange(workingCode);
  }

  const selectedModelOption = resolveAiModelOption(
    modelId,
    aiSettings,
    hubModelGroups,
    githubConnected
  );
  const requestId = stepRequestId ?? crypto.randomUUID();

  try {
    const result = await window.api.completeChatStep(
      {
        model: modelId,
        messages: [{ role: 'user', content: question.trim() }],
        scriptAsk: {
          code: workingCode,
          line,
          phase
        },
        ...(selectedModelOption?.source === 'hub' ? { hubId: selectedModelOption.hubId } : {})
      },
      requestId
    );

    const answer = parseScriptAskResult(result);
    if (!answer) {
      throw new Error('The model did not return an answer.');
    }

    onCodeChange(applyScriptAskAtLine(workingCode, line, answer, { replaceMissingAskLine: true }));
    persistScriptAskModelId(modelId);
  } catch (error) {
    if (showThinkingInEditor) {
      const lines = workingCode.split('\n');
      const index = line - 1;
      if (index >= 0 && index < lines.length) {
        lines[index] = stripScriptAskThinking(lines[index]);
        onCodeChange(lines.join('\n'));
      } else {
        onCodeChange(code);
      }
    }

    if (
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      return;
    }

    const message =
      error instanceof Error ? error.message : 'Failed to get a response from the model.';
    toast.error(message);
  }
}
