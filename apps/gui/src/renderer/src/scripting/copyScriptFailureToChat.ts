import { resolveScriptSourceCode } from '@harborclient/core/scriptRefs';
import type {
  ScriptPhase,
  ScriptRunError,
  ScriptTestResult,
  AiSettings
} from '@harborclient/core/types';
import type { ScriptSelectionLastRunFailure } from '@harborclient/core/ai/scriptReferences';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import {
  selectActiveChatId,
  setPendingComposerText
} from '#/renderer/src/store/slices/aiChatSlice';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { setScriptSelection } from '#/renderer/src/store/slices/scriptSelectionsSlice';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';
import { lineColToSelection } from '#/renderer/src/scripting/lineColToSelection';
import { resolveScriptOwnerTab } from '#/renderer/src/scripting/resolveScriptOwnerTab';
import {
  scriptRunErrorToLastRunFailure,
  testResultToLastRunFailure
} from '#/renderer/src/scripting/scriptRunDiagnostics';

/**
 * Shared inputs for copying a script failure into the AI chat composer.
 */
interface CopyScriptFailureToChatInput {
  /**
   * Script phase of the failing slot.
   */
  phase: ScriptPhase;

  /**
   * Stable script id of the failing slot.
   */
  scriptId: string;

  /**
   * Display label for the script row.
   */
  scriptLabel: string;

  /**
   * Optional request tab that produced the failure.
   */
  requestTabId?: string;

  /**
   * Preferred selection line (1-based).
   */
  line?: number;

  /**
   * Preferred selection column (1-based).
   */
  column?: number;

  /**
   * Failure payload attached to the @ reference snapshot.
   */
  lastRunFailure: ScriptSelectionLastRunFailure;

  /**
   * AI settings used when creating a new chat tab.
   */
  aiSettings: AiSettings;
}

/**
 * Returns whether a failed test row can be copied to AI chat.
 *
 * Request-scoped rows only — collection, folder, and plugin-injected scripts
 * are not addressable as `@` script references in the AI sidebar.
 *
 * @param test - hc.test result.
 * @returns True when the row has request scope, phase, and script id.
 */
export function canCopyTestResultToChat(test: ScriptTestResult): boolean {
  return test.scope === 'request' && Boolean(test.scriptId?.trim()) && Boolean(test.phase);
}

/**
 * Returns whether a script error row can be copied to AI chat.
 *
 * Request-scoped rows only — collection, folder, and plugin-injected scripts
 * are not addressable as `@` script references in the AI sidebar.
 *
 * @param error - Structured script failure.
 * @returns True when the row has request scope, phase, and script id.
 */
export function canCopyScriptErrorToChat(error: ScriptRunError): boolean {
  return error.scope === 'request' && Boolean(error.scriptId?.trim()) && Boolean(error.phase);
}

/**
 * Opens the AI sidebar with an @ script reference that includes the failure.
 *
 * @param dispatch - Redux dispatch.
 * @param getState - Store getter.
 * @param input - Script slot, selection location, and failure payload.
 * @returns True when the composer was updated.
 */
export async function copyScriptFailureToChat(
  dispatch: AppDispatch,
  getState: () => RootState,
  input: CopyScriptFailureToChatInput
): Promise<boolean> {
  const { phase, scriptId, scriptLabel, requestTabId, line, column, lastRunFailure, aiSettings } =
    input;

  const requestTab = resolveScriptOwnerTab(getState(), phase, scriptId, requestTabId);
  if (!requestTab) {
    return false;
  }

  const scripts =
    phase === 'pre' ? requestTab.draft.pre_request_scripts : requestTab.draft.post_request_scripts;
  const scriptIndex = scripts.findIndex((script) => script.id === scriptId);
  if (scriptIndex < 0) {
    return false;
  }

  const script = scripts[scriptIndex];
  if (script == null) {
    return false;
  }

  const snippets = selectSnippets(getState());
  const source = resolveScriptSourceCode(script, snippets);
  const selection =
    line != null && Number.isFinite(line)
      ? lineColToSelection(source, line, column)
      : { anchor: 0, head: Math.min(source.length, Math.max(1, source.length)) };

  const startOffset = Math.min(selection.anchor, selection.head);
  const endOffset = Math.max(selection.anchor, selection.head);
  const selectedText =
    startOffset < endOffset ? source.slice(startOffset, endOffset) : source.slice(0, endOffset);
  const oneBasedIndex = scriptIndex + 1;
  const token = `@active.${phase}.${oneBasedIndex}#${startOffset}.${endOffset}`;
  const requestId = requestTab.draft.id ?? 'active';

  dispatch(
    setScriptSelection({
      token,
      snapshot: {
        scriptLabel,
        phase,
        scriptIndex: oneBasedIndex,
        requestId,
        source,
        selectedText,
        startOffset,
        endOffset,
        startLine: lineNumberAtOffset(source, startOffset),
        endLine: lineNumberAtOffset(source, Math.max(startOffset, endOffset - 1)),
        lastRunFailure
      }
    })
  );
  dispatch(setShowAiSidebar(true));
  if (selectActiveChatId(getState()) == null) {
    await dispatch(createNewChat(aiSettings));
  }
  dispatch(setPendingComposerText(token));
  return true;
}

/**
 * Copies a failed hc.test row into the AI chat composer with failure context.
 *
 * @param dispatch - Redux dispatch.
 * @param getState - Store getter.
 * @param test - Failed test row.
 * @param requestTabId - Optional owning request tab id.
 * @param aiSettings - AI settings for new-chat creation.
 * @returns True when the composer was updated.
 */
export async function copyTestResultToChat(
  dispatch: AppDispatch,
  getState: () => RootState,
  test: ScriptTestResult,
  requestTabId: string | undefined,
  aiSettings: AiSettings
): Promise<boolean> {
  if (!canCopyTestResultToChat(test) || !test.scriptId || !test.phase) {
    return false;
  }

  return copyScriptFailureToChat(dispatch, getState, {
    phase: test.phase,
    scriptId: test.scriptId,
    scriptLabel: test.scriptName?.trim() || test.name,
    requestTabId,
    line: test.line,
    column: test.column,
    lastRunFailure: testResultToLastRunFailure(test),
    aiSettings
  });
}

/**
 * Copies a script runtime error into the AI chat composer with failure context.
 *
 * @param dispatch - Redux dispatch.
 * @param getState - Store getter.
 * @param error - Structured script failure.
 * @param requestTabId - Optional owning request tab id.
 * @param aiSettings - AI settings for new-chat creation.
 * @returns True when the composer was updated.
 */
export async function copyScriptErrorToChat(
  dispatch: AppDispatch,
  getState: () => RootState,
  error: ScriptRunError,
  requestTabId: string | undefined,
  aiSettings: AiSettings
): Promise<boolean> {
  if (!canCopyScriptErrorToChat(error) || !error.scriptId || !error.phase) {
    return false;
  }

  return copyScriptFailureToChat(dispatch, getState, {
    phase: error.phase,
    scriptId: error.scriptId,
    scriptLabel: error.scriptName?.trim() || 'script',
    requestTabId,
    line: error.line,
    column: error.column,
    lastRunFailure: scriptRunErrorToLastRunFailure(error),
    aiSettings
  });
}

/**
 * Converts a character offset into a 1-based line number.
 *
 * @param source - Full script source.
 * @param offset - 0-based character offset.
 * @returns 1-based line number.
 */
function lineNumberAtOffset(source: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  for (let i = 0; i < clamped; i++) {
    if (source[i] === '\n') {
      line += 1;
    }
  }
  return line;
}
