import type { RequestRunnerDeps, RunRequestResult } from '../../requestRunner/types';
import { runRequest } from '../../requestRunner/RequestRunner';
import type { WorkflowAction } from '../../types/workflow';
import type { WorkflowActionExecutor } from '../types';
import { noteWorkflowScriptDirectives } from '../workflowScriptContext';
import {
  draftFromSavedRequest,
  HEADLESS_SKIPPED_ACTION_TYPES,
  mergeWorkflowDraftPayload,
  parseWorkflowDraftPayload,
  type HeadlessWorkflowHost,
  type HeadlessWorkflowSession
} from './session';

/**
 * Options for creating a headless workflow action executor.
 */
export interface CreateHeadlessWorkflowExecutorOptions {
  /**
   * Mutable session state shared across steps.
   */
  session: HeadlessWorkflowSession;

  /**
   * Storage / lookup host.
   */
  host: HeadlessWorkflowHost;

  /**
   * Request runner dependencies (transport, scripts, cookies, settings).
   */
  runnerDeps: RequestRunnerDeps;

  /**
   * Workflow UUID for hc.info (also set via script context by the engine).
   */
  workflowUuid: string;
}

/**
 * Creates a headless {@link WorkflowActionExecutor} for CLI / non-UI playback.
 *
 * Executes request.load, request.draft, request.send, and environment.activate.
 * Skips pure UI and persistence actions listed in {@link HEADLESS_SKIPPED_ACTION_TYPES}.
 *
 * @param options - Session, host, and runner dependencies.
 * @returns Executor suitable for {@link runWorkflow}.
 */
export function createHeadlessWorkflowExecutor(
  options: CreateHeadlessWorkflowExecutorOptions
): WorkflowActionExecutor {
  const { session, host, runnerDeps, workflowUuid } = options;

  return {
    /**
     * Plays one headless workflow action.
     *
     * @param action - Recorded action.
     * @param index - 0-based action index for script info.
     * @returns Send result for request.send; undefined for other steps.
     */
    async play(action: WorkflowAction, index: number): Promise<unknown> {
      if (HEADLESS_SKIPPED_ACTION_TYPES.has(action.type)) {
        return undefined;
      }

      switch (action.type) {
        case 'request.load':
          await playRequestLoad(action, session, host);
          return undefined;
        case 'request.draft':
          playRequestDraft(action, session);
          return undefined;
        case 'environment.activate':
          await playEnvironmentActivate(action, session, host);
          return undefined;
        case 'request.send':
          return playRequestSend(session, host, runnerDeps, workflowUuid, index);
        default:
          throw new Error(`Unsupported workflow action type for headless playback: ${action.type}`);
      }
    }
  };
}

/**
 * Loads a saved request into the headless session draft.
 *
 * @param action - request.load action.
 * @param session - Mutable headless session.
 * @param host - Storage host.
 */
async function playRequestLoad(
  action: WorkflowAction,
  session: HeadlessWorkflowSession,
  host: HeadlessWorkflowHost
): Promise<void> {
  const payload = (action.payload ?? {}) as { uuid?: string; id?: number };
  const uuid =
    typeof payload.uuid === 'string' && payload.uuid.length > 0 ? payload.uuid : undefined;
  const id = typeof payload.id === 'number' ? payload.id : undefined;
  const request = await host.resolveRequest({ uuid, id });
  if (request == null) {
    const label = uuid ?? (id != null ? String(id) : 'unknown');
    throw new Error(`Request not found for playback (${label}).`);
  }
  session.activeDraft = draftFromSavedRequest(request);
}

/**
 * Applies a recorded draft patch onto the headless session.
 *
 * @param action - request.draft action.
 * @param session - Mutable headless session.
 */
function playRequestDraft(action: WorkflowAction, session: HeadlessWorkflowSession): void {
  const payload = parseWorkflowDraftPayload(action.payload);
  if (payload == null) {
    throw new Error('Invalid request.draft payload for playback.');
  }
  session.activeDraft = mergeWorkflowDraftPayload(session.activeDraft, payload);
}

/**
 * Activates or clears the environment on the headless session.
 *
 * @param action - environment.activate action.
 * @param session - Mutable headless session.
 * @param host - Storage host.
 */
async function playEnvironmentActivate(
  action: WorkflowAction,
  session: HeadlessWorkflowSession,
  host: HeadlessWorkflowHost
): Promise<void> {
  const payload = action.payload as
    | { environmentId?: number | null; uuid?: string | null }
    | undefined;

  if (payload?.uuid != null && typeof payload.uuid === 'string') {
    const environment = await host.getEnvironmentByUuid(payload.uuid);
    if (environment == null) {
      throw new Error(`Environment not found for playback (${payload.uuid}).`);
    }
    session.activeEnvironmentUuid = environment.uuid;
    return;
  }

  const environmentId = payload?.environmentId ?? null;
  if (environmentId === null) {
    session.activeEnvironmentUuid = null;
    return;
  }
  if (typeof environmentId !== 'number') {
    throw new Error('Invalid environment.activate payload for playback.');
  }
  const environment = await host.getEnvironmentById(environmentId);
  if (environment == null) {
    throw new Error(`Environment not found for playback (id ${environmentId}).`);
  }
  session.activeEnvironmentUuid = environment.uuid;
}

/**
 * Sends the active headless draft via {@link runRequest}.
 *
 * @param session - Mutable headless session.
 * @param host - Storage host.
 * @param runnerDeps - Request runner dependencies.
 * @param workflowUuid - Workflow UUID for script info.
 * @param index - Action index for script info.
 * @returns Portable run result (also notes workflow script directives).
 */
async function playRequestSend(
  session: HeadlessWorkflowSession,
  host: HeadlessWorkflowHost,
  runnerDeps: RequestRunnerDeps,
  workflowUuid: string,
  index: number
): Promise<RunRequestResult> {
  const draft = session.activeDraft;
  if (draft == null) {
    throw new Error('No active request draft for request.send playback.');
  }

  const collection =
    draft.collection_id != null ? await host.getCollection(draft.collection_id) : null;
  const folder =
    draft.collection_id != null && typeof draft.folder_id === 'number'
      ? await host.getFolder(draft.collection_id, draft.folder_id)
      : null;
  const environment =
    session.activeEnvironmentUuid != null
      ? await host.getEnvironmentByUuid(session.activeEnvironmentUuid)
      : null;

  const scripts = [
    ...(collection?.pre_request_script?.trim()
      ? [
          {
            phase: 'pre' as const,
            label: 'Collection pre-request',
            source: collection.pre_request_script
          }
        ]
      : []),
    ...(folder?.pre_request_script?.trim()
      ? [
          {
            phase: 'pre' as const,
            label: 'Folder pre-request',
            source: folder.pre_request_script
          }
        ]
      : []),
    ...(draft.pre_request_script.trim()
      ? [
          {
            phase: 'pre' as const,
            label: 'Pre-request',
            source: draft.pre_request_script
          }
        ]
      : []),
    ...(draft.post_request_script.trim()
      ? [
          {
            phase: 'post' as const,
            label: 'Post-request',
            source: draft.post_request_script
          }
        ]
      : []),
    ...(folder?.post_request_script?.trim()
      ? [
          {
            phase: 'post' as const,
            label: 'Folder post-request',
            source: folder.post_request_script
          }
        ]
      : []),
    ...(collection?.post_request_script?.trim()
      ? [
          {
            phase: 'post' as const,
            label: 'Collection post-request',
            source: collection.post_request_script
          }
        ]
      : [])
  ];

  const result = await runRequest(
    {
      request: {
        method: draft.method,
        url: draft.url,
        headers: draft.headers.map((row) => ({ ...row })),
        params: draft.params.map((row) => ({ ...row })),
        body: draft.body,
        bodyType: draft.body_type,
        auth: structuredClone(draft.auth),
        userAgent: draft.userAgent,
        tags: draft.tags,
        comment: draft.comment
      },
      requestIdentity: {
        id: draft.id,
        name: draft.name,
        bodyRaw: draft.body_raw
      },
      collection: collection ?? undefined,
      folder: folder ?? undefined,
      environment: environment
        ? { name: environment.name, variables: environment.variables }
        : undefined,
      scripts,
      workflow: {
        workflowId: workflowUuid,
        workflowActionIteration: index
      }
    },
    runnerDeps
  );

  noteWorkflowScriptDirectives({
    workflowNextAction: result.workflowNextAction,
    workflowSkipAction: result.workflowSkipAction
  });

  return result;
}
