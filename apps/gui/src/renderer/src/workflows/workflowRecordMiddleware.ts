import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import { installWorkflowLogGlobal, processWorkflowAction } from './workflowRecorder';

installWorkflowLogGlobal();

/**
 * Records allowlisted Redux actions into the in-memory workflow activity log.
 *
 * Runs after the action reaches reducers so `getState()` (when used later by
 * handlers) reflects the post-action store. Unknown actions are ignored.
 */
export const workflowRecordMiddleware: Middleware = () => (next) => (action) => {
  const result = next(action);
  processWorkflowAction(action as UnknownAction);
  return result;
};
