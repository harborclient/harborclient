import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '#/renderer/src/store/redux';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { resolveTabIdentity } from './workflowIdentity';
import { installWorkflowLogGlobal, processWorkflowAction } from './workflowRecorder';
import { prepareTabCloseRecording } from './workflowTabCloseBridge';

installWorkflowLogGlobal();

/**
 * Records allowlisted Redux actions into the in-memory workflow activity log.
 *
 * Runs after the action reaches reducers so `getState()` reflects the
 * post-action store for identity resolution. For `closeTab`, identity is
 * captured before the reducer removes the tab.
 */
export const workflowRecordMiddleware: Middleware = (store) => (next) => (action) => {
  const unknownAction = action as UnknownAction;
  if (unknownAction.type === closeTab.type && typeof unknownAction.payload === 'string') {
    prepareTabCloseRecording(
      resolveTabIdentity(store.getState() as RootState, unknownAction.payload)
    );
  }

  const result = next(action);
  processWorkflowAction(unknownAction, store.getState as () => RootState);
  return result;
};
