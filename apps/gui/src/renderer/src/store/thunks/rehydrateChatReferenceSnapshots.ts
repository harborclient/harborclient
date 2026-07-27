import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import type { ChatMessage } from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';
import {
  selectMarkdownSelections,
  setMarkdownSelection
} from '#/renderer/src/store/slices/markdownSelectionsSlice';
import {
  selectRequestBodySelections,
  setRequestBodySelection
} from '#/renderer/src/store/slices/requestBodySelectionsSlice';
import {
  selectResponseSelections,
  setResponseSelection
} from '#/renderer/src/store/slices/responseSelectionsSlice';
import {
  selectScriptSelections,
  setScriptSelection
} from '#/renderer/src/store/slices/scriptSelectionsSlice';
import {
  selectTerminalSelections,
  setTerminalSelection
} from '#/renderer/src/store/slices/terminalsSlice';

/**
 * Restores persisted `@` reference snapshots from chat messages into Redux selection slices.
 *
 * Skips tokens that already have an in-session snapshot so fresher copy-to-chat data is not
 * overwritten when chats reload.
 *
 * @param messages - Chat messages that may include `referenceSnapshots`.
 * @param dispatch - Redux dispatch for selection slice actions.
 * @param getState - Reads current Redux root state to detect existing snapshots.
 */
export function rehydrateChatReferenceSnapshots(
  messages: ChatMessage[],
  dispatch: Dispatch<UnknownAction>,
  getState: () => RootState
): void {
  const state = getState();
  const seenResponse = new Set(Object.keys(selectResponseSelections(state)));
  const seenScript = new Set(Object.keys(selectScriptSelections(state)));
  const seenTerminal = new Set(Object.keys(selectTerminalSelections(state)));
  const seenMarkdown = new Set(Object.keys(selectMarkdownSelections(state)));
  const seenBody = new Set(Object.keys(selectRequestBodySelections(state)));

  for (const message of messages) {
    const snapshots = message.referenceSnapshots;
    if (snapshots == null) {
      continue;
    }

    for (const [token, entry] of Object.entries(snapshots)) {
      switch (entry.kind) {
        case 'response-section':
          if (!seenResponse.has(token)) {
            dispatch(setResponseSelection({ token, snapshot: entry.snapshot }));
            seenResponse.add(token);
          }
          break;
        case 'script-selection':
          if (!seenScript.has(token)) {
            dispatch(setScriptSelection({ token, snapshot: entry.snapshot }));
            seenScript.add(token);
          }
          break;
        case 'terminal':
          if (!seenTerminal.has(token)) {
            dispatch(setTerminalSelection({ token, snapshot: entry.snapshot }));
            seenTerminal.add(token);
          }
          break;
        case 'markdown':
          if (!seenMarkdown.has(token)) {
            dispatch(setMarkdownSelection({ token, snapshot: entry.snapshot }));
            seenMarkdown.add(token);
          }
          break;
        case 'body':
          if (!seenBody.has(token)) {
            dispatch(setRequestBodySelection({ token, snapshot: entry.snapshot }));
            seenBody.add(token);
          }
          break;
      }
    }
  }
}
