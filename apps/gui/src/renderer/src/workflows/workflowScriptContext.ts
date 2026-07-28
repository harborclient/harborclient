/**
 * Workflow identity and action cursor exposed to request scripts during playback.
 */
export interface WorkflowScriptContext {
  /**
   * UUID of the workflow being played.
   */
  workflowId: string;

  /**
   * UUID of the action currently being played.
   */
  workflowActionId: string;

  /**
   * 0-based index of the action currently being played.
   */
  workflowActionIteration: number;
}

/**
 * Flow-control directives produced by hc.execution.workflow* during a send.
 */
export interface WorkflowScriptDirectives {
  /**
   * Target action UUID from hc.execution.workflowNextAction, if any.
   */
  workflowNextAction?: string;

  /**
   * True when hc.execution.workflowSkipAction ran during the send.
   */
  workflowSkipAction?: boolean;
}

let activeContext: WorkflowScriptContext | null = null;
let lastDirectives: WorkflowScriptDirectives = {};

/**
 * Installs workflow script context for the action about to play and clears prior directives.
 *
 * @param context - Workflow and action identity for hc.info.
 */
export function beginWorkflowActionScriptContext(context: WorkflowScriptContext): void {
  activeContext = context;
  lastDirectives = {};
}

/**
 * Clears the active workflow script context after an action finishes.
 */
export function endWorkflowActionScriptContext(): void {
  activeContext = null;
}

/**
 * Returns the workflow context for the action currently playing, if any.
 *
 * @returns Active context, or null outside workflow playback.
 */
export function getActiveWorkflowScriptContext(): WorkflowScriptContext | null {
  return activeContext;
}

/**
 * Merges workflow flow-control directives from a completed send into the pending bag.
 *
 * Ignored when no workflow action context is active.
 *
 * @param directives - Directives aggregated from script results.
 */
export function noteWorkflowScriptDirectives(directives: WorkflowScriptDirectives): void {
  if (activeContext == null) {
    return;
  }
  if (directives.workflowNextAction !== undefined) {
    lastDirectives.workflowNextAction = directives.workflowNextAction;
  }
  if (directives.workflowSkipAction) {
    lastDirectives.workflowSkipAction = true;
  }
}

/**
 * Returns and clears directives recorded for the current workflow action.
 *
 * @returns Pending workflow flow-control directives.
 */
export function takeWorkflowScriptDirectives(): WorkflowScriptDirectives {
  const taken = lastDirectives;
  lastDirectives = {};
  return taken;
}

/**
 * Resets module state for unit tests.
 */
export function resetWorkflowScriptContextForTests(): void {
  activeContext = null;
  lastDirectives = {};
}
