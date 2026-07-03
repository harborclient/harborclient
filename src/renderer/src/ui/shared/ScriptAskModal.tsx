import { Button, Select, Textarea, fieldFrame, portalToBody } from '@harborclient/sdk/components';
import type { CodeEditorSlashTrigger } from '@harborclient/sdk/components';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent
} from 'react';
import { getAvailableModels } from '#/shared/aiModels';
import { removeScriptAskLine } from '#/shared/aiScriptAsk';
import type { AiSettings, HubLlmModelGroup } from '#/shared/types';
import { runScriptAsk } from '#/renderer/src/scripting/runScriptAsk';
import { resolveScriptAskModelId } from '#/renderer/src/scripting/scriptAskModel';

interface Props {
  /**
   * Parsed slash command trigger from the script editor.
   */
  trigger: CodeEditorSlashTrigger;

  /**
   * Current script source from the editor.
   */
  code: string;

  /**
   * Script phase for the mini-agent system prompt.
   */
  phase: 'pre' | 'post';

  /**
   * AI provider settings for model availability.
   */
  aiSettings: AiSettings;

  /**
   * Team Hub model groups for hub-proxied models.
   */
  hubModelGroups: HubLlmModelGroup[];

  /**
   * Active chat model id used when no script ask model is stored.
   */
  preferredChatModelId?: string;

  /**
   * Applies updated script source after a successful answer or cancel cleanup.
   */
  onApply: (code: string) => void;

  /**
   * Closes the modal without further action.
   */
  onClose: () => void;
}

/**
 * Anchored mini chat dialog for inline `/ask` requests in script editors.
 */
export function ScriptAskModal({
  trigger,
  code,
  phase,
  aiSettings,
  hubModelGroups,
  preferredChatModelId,
  onApply,
  onClose
}: Props): JSX.Element {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stepRequestIdRef = useRef<string | null>(null);
  const appliedRef = useRef(false);
  const codeRef = useRef(code);
  const triggerRef = useRef(trigger);
  const onApplyRef = useRef(onApply);
  const availableModels = getAvailableModels(aiSettings, hubModelGroups);
  const [draft, setDraft] = useState(trigger.args);
  const [modelIdOverride, setModelIdOverride] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modelId = modelIdOverride ?? resolveScriptAskModelId(availableModels, preferredChatModelId);
  const canSend = draft.trim().length > 0 && !sending && modelId.length > 0;

  /**
   * Closes the modal and removes the slash command when the user dismisses without sending.
   */
  const handleDismiss = useCallback((): void => {
    if (sending && stepRequestIdRef.current) {
      void window.api.cancelChatStep(stepRequestIdRef.current);
    }
    if (!appliedRef.current) {
      onApplyRef.current(removeScriptAskLine(codeRef.current, triggerRef.current.line));
    }
    onClose();
  }, [onClose, sending]);

  /**
   * Keeps cleanup refs aligned with the latest script source, trigger span, and apply callback.
   */
  useEffect(() => {
    codeRef.current = code;
    triggerRef.current = trigger;
    onApplyRef.current = onApply;
  }, [code, onApply, trigger]);

  /**
   * Focuses the prompt field when the modal opens.
   */
  useEffect(() => {
    queueMicrotask(() => {
      textareaRef.current?.focus();
    });
  }, []);

  /**
   * Closes the modal when Escape is pressed.
   */
  useEffect(() => {
    /**
     * Dismisses the dialog on Escape key press.
     *
     * @param event - Document keydown event.
     */
    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleDismiss]);

  /**
   * Aborts the in-flight script ask request.
   */
  const handleStop = (): void => {
    if (!sending || stepRequestIdRef.current == null) {
      return;
    }
    void window.api.cancelChatStep(stepRequestIdRef.current);
  };

  /**
   * Sends the inline script ask request and applies the model answer into the editor.
   */
  const handleSend = async (): Promise<void> => {
    if (!canSend) {
      return;
    }

    setError(null);
    setSending(true);
    const stepRequestId = crypto.randomUUID();
    stepRequestIdRef.current = stepRequestId;

    try {
      await runScriptAsk({
        code: codeRef.current,
        line: triggerRef.current.line,
        phase,
        question: draft.trim(),
        modelId,
        aiSettings,
        hubModelGroups,
        showThinkingInEditor: false,
        stepRequestId,
        onCodeChange: (nextCode) => {
          if (nextCode === codeRef.current) {
            return;
          }
          appliedRef.current = true;
          codeRef.current = nextCode;
          onApplyRef.current(nextCode);
        }
      });
      if (appliedRef.current) {
        onClose();
      }
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : 'Failed to get a response from the model.';
      setError(message);
    } finally {
      setSending(false);
      stepRequestIdRef.current = null;
    }
  };

  /**
   * Sends on Enter without Shift, matching the sidebar chat composer.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && canSend) {
      event.preventDefault();
      void handleSend();
    }
  };

  const panelStyle = {
    top: Math.min(trigger.coords.bottom + 8, window.innerHeight - 280),
    left: Math.min(trigger.coords.left, window.innerWidth - 360)
  };

  return portalToBody(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-transparent app-no-drag"
      onClick={handleDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute w-[min(360px,calc(100vw-24px))] rounded-2xl border border-separator bg-surface p-3 shadow-xl app-no-drag"
        style={panelStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="sr-only">
          Ask AI about this script
        </h2>
        <div className="flex flex-col gap-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            placeholder="Ask a short question…"
            aria-label="Script question"
            disabled={sending}
            className={`min-h-[72px] w-full resize-none px-2.5 py-1.5 text-[16px] ${fieldFrame}`}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center justify-between gap-2">
            <Select
              id="script-ask-model"
              className="min-w-0 flex-1 cursor-pointer py-1 text-[14px]"
              value={modelId}
              disabled={sending || availableModels.length === 0}
              aria-label="AI model"
              onChange={(event) => setModelIdOverride(event.target.value)}
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              className="w-[80px]"
              disabled={sending ? false : !canSend}
              aria-label={sending ? 'Stop generating' : undefined}
              onClick={() => (sending ? handleStop() : void handleSend())}
            >
              {sending ? 'Stop' : 'Send'}
            </Button>
          </div>
          {sending ? (
            <p className="text-[14px] text-muted" role="status">
              Thinking…
            </p>
          ) : null}
          {error ? (
            <p className="text-[14px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
