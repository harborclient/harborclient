import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import { operationFinished, operationStarted } from '#/renderer/src/store/slices/uiSlice';

const EXCLUDED_THUNKS = new Set([
  'tabs/sendRequest',
  'tabs/cancelRequest',
  'aiChat/sendMessage',
  'aiChat/cancelMessage',
  'aiChat/generateTitle'
]);

const pendingRequests = new Set<string>();

type AsyncPhase = 'pending' | 'fulfilled' | 'rejected';

/**
 * Parses RTK async action types into thunk name and phase.
 */
function parseAsyncActionType(actionType: string): { thunkType: string; phase: AsyncPhase } | null {
  const match = actionType.match(/^(.+)\/(pending|fulfilled|rejected)$/);
  if (!match) return null;
  return { thunkType: match[1], phase: match[2] as AsyncPhase };
}

/**
 * Returns whether an action is an RTK async thunk lifecycle action.
 */
function isAsyncThunkAction(action: unknown): action is UnknownAction & {
  meta: { requestId: string };
} {
  if (typeof action !== 'object' || action === null) return false;
  const meta = (action as UnknownAction).meta;
  return typeof meta === 'object' && meta != null && 'requestId' in meta;
}

/**
 * Tracks in-flight RTK async thunks and updates global busy state.
 * HTTP send/cancel, AI chat send, and background chat title generation are excluded because
 * they have dedicated UI feedback or should not block the rest of the app.
 */
export const busyMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);

  if (!isAsyncThunkAction(action)) {
    return result;
  }

  const parsed = parseAsyncActionType(action.type);
  if (!parsed || EXCLUDED_THUNKS.has(parsed.thunkType)) {
    return result;
  }

  const { requestId } = action.meta;

  if (parsed.phase === 'pending') {
    if (!pendingRequests.has(requestId)) {
      pendingRequests.add(requestId);
      store.dispatch(operationStarted());
    }
    return result;
  }

  if (pendingRequests.has(requestId)) {
    pendingRequests.delete(requestId);
    store.dispatch(operationFinished());
  }

  return result;
};
