import { buildScriptRunInfo } from '../types/script';
import type {
  KeyValue,
  ScriptLogEntry,
  ScriptRequestContext,
  ScriptResponseOverride,
  ScriptRunResult,
  SendResult
} from '../types';
import { enrichScriptLogLines } from '../scripting/scriptLogs';
import { applyScriptResponseOverride } from '../scripting/scriptResponseOverride';
import { getActiveWorkflowScriptContext } from '../workflowRunner/workflowScriptContext';
import { buildSendInput, resolveRequestVariables, substituteRequestVariables } from './helpers';
import type { RequestRunnerDeps, RunRequestInput, RunRequestResult } from './types';

/**
 * Runs a request pipeline without depending on Redux, Electron, or browser globals.
 */
export class RequestRunner {
  /**
   * Creates a runner with the host services used by every request.
   *
   * @param deps - Host-provided transport, script runtime, and persistence services.
   */
  public constructor(private readonly deps: RequestRunnerDeps) {}

  /**
   * Runs pre-request scripts, prepares and sends HTTP, then runs post-request scripts.
   *
   * Script source resolution and persistence of collection, folder, environment, and
   * global mutations remain host responsibilities; this runner returns their events.
   *
   * @param input - UI-independent request context and inheritance data.
   * @returns HTTP result plus script diagnostics and flow-control state.
   */
  public async run(input: RunRequestInput): Promise<RunRequestResult> {
    let request = cloneRequestContext(input.request);
    let variables = resolveRequestVariables(input);
    const scriptLogs: ScriptLogEntry[] = [];
    const testResults: RunRequestResult['testResults'] = [];
    const executionEvents: RunRequestResult['executionEvents'] = [];
    const scriptErrors: string[] = [];
    let scriptNextRequest: string | null | undefined;
    let scriptSkipRequest = false;
    let scriptResponseOverride: ScriptResponseOverride | undefined;
    let workflowNextAction: string | undefined;
    let workflowSkipAction = false;
    const cookieDomain = resolveCookieDomain(substituteRequestVariables(request.url, variables));
    let cookies = cookieDomain ? this.deps.cookieJar.getCookiesForDomain(cookieDomain) : [];
    const activeWorkflow = getActiveWorkflowScriptContext();
    const workflowInfo = {
      workflowId: input.workflow?.workflowId ?? activeWorkflow?.workflowId,
      workflowActionId: input.workflow?.workflowActionId ?? activeWorkflow?.workflowActionId,
      workflowActionIteration:
        input.workflow?.workflowActionIteration ?? activeWorkflow?.workflowActionIteration
    };

    /**
     * Runs one script phase and applies its portable runtime mutations.
     *
     * @param phase - Pre scripts run before transport; post scripts receive the response.
     * @param response - Response passed to post-request scripts.
     */
    const runPhase = async (phase: 'pre' | 'post', response?: SendResult): Promise<void> => {
      if (!this.deps.scriptRunner) {
        return;
      }
      for (const script of input.scripts?.filter((candidate) => candidate.phase === phase) ?? []) {
        const result = await this.deps.scriptRunner.run({
          phase,
          script: substituteRequestVariables(script.source, variables),
          request,
          response,
          variables,
          cookies,
          info: buildScriptRunInfo(phase, {
            requestName: input.requestIdentity?.name,
            requestId: input.requestIdentity?.id,
            ...workflowInfo
          }),
          collection: input.collection
            ? {
                id: input.collection.id,
                name: input.collection.name,
                connectionId: input.collection.connectionId ?? null,
                headers: input.collection.headers.map((header) => ({ ...header })),
                auth: input.collection.auth
              }
            : undefined,
          folder: input.folder
            ? {
                id: input.folder.id,
                name: input.folder.name,
                headers: input.folder.headers.map((header) => ({ ...header })),
                auth: input.folder.auth
              }
            : undefined,
          environment: { name: input.environment?.name ?? '' }
        });
        request = cloneRequestContext(result.request);
        variables = applyScriptVariables(variables, result);
        cookies = applyCookieChanges(cookies, result);
        collectScriptResult(script, result, scriptLogs, testResults, executionEvents, scriptErrors);
        if (result.nextRequest !== undefined) {
          scriptNextRequest = result.nextRequest;
        }
        scriptSkipRequest ||= result.skipRequest === true;
        if (result.responseOverride) {
          scriptResponseOverride = result.responseOverride;
        }
        if (result.workflowNextAction !== undefined) {
          workflowNextAction = result.workflowNextAction;
        }
        workflowSkipAction ||= result.workflowSkipAction === true;
      }
    };

    try {
      await runPhase('pre');
      if (scriptSkipRequest) {
        let skipped = skippedResult();
        if (scriptResponseOverride) {
          skipped = applyScriptResponseOverride(skipped, scriptResponseOverride);
        }
        return buildResult(
          skipped,
          undefined,
          testResults,
          scriptLogs,
          executionEvents,
          scriptErrors,
          scriptNextRequest,
          true,
          workflowNextAction,
          workflowSkipAction
        );
      }

      const sendInput = await buildSendInput(input, request, variables, this.deps);
      const transportInput = this.deps.pluginHooks?.beforeSend
        ? await this.deps.pluginHooks.beforeSend(sendInput)
        : sendInput;
      let response = await this.deps.transport(transportInput, input.signal);
      if (!response.error && this.deps.pluginHooks?.afterSend) {
        await this.deps.pluginHooks.afterSend(transportInput, response);
      }
      if (scriptResponseOverride) {
        response = applyScriptResponseOverride(response, scriptResponseOverride);
      }
      scriptResponseOverride = undefined;
      await runPhase('post', response);
      if (scriptResponseOverride) {
        response = applyScriptResponseOverride(response, scriptResponseOverride);
      }
      if (cookieDomain && hasScriptCookieChanges(input, cookies)) {
        await this.saveCookies(cookieDomain, cookies);
      }
      return buildResult(
        response,
        transportInput,
        testResults,
        scriptLogs,
        executionEvents,
        scriptErrors,
        scriptNextRequest,
        false,
        workflowNextAction,
        workflowSkipAction
      );
    } catch (error) {
      return buildResult(
        errorResult(error),
        undefined,
        testResults,
        scriptLogs,
        executionEvents,
        scriptErrors,
        scriptNextRequest,
        scriptSkipRequest,
        workflowNextAction,
        workflowSkipAction
      );
    }
  }

  /**
   * Persists script-managed cookie rows through the host's preferred adapter.
   *
   * @param domain - Hostname resolved before script execution began.
   * @param cookies - Final script-visible cookie rows.
   */
  private async saveCookies(domain: string, cookies: KeyValue[]): Promise<void> {
    if (this.deps.persistence?.saveCookies) {
      await this.deps.persistence.saveCookies(domain, cookies);
      return;
    }
    this.deps.cookieJar.setCookiesForDomain(domain, cookies);
  }
}

/**
 * Runs a request once without explicitly constructing a RequestRunner instance.
 *
 * @param input - UI-independent request context and inheritance data.
 * @param deps - Host-provided transport, script runtime, and persistence services.
 * @returns HTTP result plus script diagnostics and flow-control state.
 */
export async function runRequest(
  input: RunRequestInput,
  deps: RequestRunnerDeps
): Promise<RunRequestResult> {
  return new RequestRunner(deps).run(input);
}

/**
 * Clones script-owned request data so a runner never mutates host state.
 *
 * @param request - Request context supplied by the host.
 * @returns Independent request context for script execution.
 */
function cloneRequestContext(request: ScriptRequestContext): ScriptRequestContext {
  return {
    ...request,
    headers: request.headers.map((header) => ({ ...header })),
    params: request.params.map((param) => ({ ...param })),
    auth: request.auth ? structuredClone(request.auth) : undefined
  };
}

/**
 * Applies all variable writes and clears emitted by one script to runtime values.
 *
 * @param variables - Current effective runtime variable map.
 * @param result - Script result containing mutations from all scopes.
 * @returns Runtime values visible to subsequent scripts and the send.
 */
function applyScriptVariables(
  variables: Record<string, string>,
  result: ScriptRunResult
): Record<string, string> {
  const next = {
    ...variables,
    ...result.variableSets,
    ...result.globalVariableSets,
    ...result.collectionVariableSets,
    ...result.folderVariableSets,
    ...result.environmentVariableSets
  };
  for (const key of [
    ...result.variableClears,
    ...result.globalVariableClears,
    ...result.collectionVariableClears,
    ...result.folderVariableClears,
    ...result.environmentVariableClears
  ]) {
    delete next[key.trim()];
  }
  return next;
}

/**
 * Applies cookie mutations to the script-visible host cookie rows.
 *
 * @param cookies - Cookies read before scripts ran.
 * @param result - One script's cookie sets and clears.
 * @returns Updated cookie rows.
 */
function applyCookieChanges(cookies: KeyValue[], result: ScriptRunResult): KeyValue[] {
  const cleared = new Set(result.cookieClears.map((key) => key.trim().toLowerCase()));
  const next = cookies
    .filter((cookie) => !cleared.has(cookie.key.trim().toLowerCase()))
    .map((cookie) => ({ ...cookie }));
  for (const [key, value] of Object.entries(result.cookieSets)) {
    const index = next.findIndex((cookie) => cookie.key.trim().toLowerCase() === key.toLowerCase());
    if (index >= 0) {
      next[index] = { ...next[index], value, enabled: true };
    } else {
      next.push({ key, value, enabled: true });
    }
  }
  return next;
}

/**
 * Adds labeled diagnostics from a script result to runner aggregates.
 *
 * @param script - Script descriptor that produced the result (label and optional identity).
 * @param result - Script output to collect.
 * @param logs - Mutable log aggregate.
 * @param tests - Mutable test aggregate.
 * @param events - Mutable execution-event aggregate.
 * @param errors - Mutable error aggregate.
 */
function collectScriptResult(
  script: {
    label: string;
    scriptId?: string;
    phase: 'pre' | 'post';
    scope?: 'collection' | 'folder' | 'request';
  },
  result: ScriptRunResult,
  logs: ScriptLogEntry[],
  tests: RunRequestResult['testResults'],
  events: RunRequestResult['executionEvents'],
  errors: string[]
): void {
  if (result.logs.length) {
    logs.push(...enrichScriptLogLines(result.logs, script));
  }
  tests.push(
    ...result.tests.map((test) => ({
      ...test,
      scriptName: script.label,
      scriptId: script.scriptId,
      phase: script.phase,
      scope: script.scope
    }))
  );
  events.push(...result.executionEvents.map((event) => ({ ...event, scriptName: script.label })));
  if (result.error) errors.push(`${script.label}: ${result.error}`);
}

/**
 * Resolves a URL hostname without rejecting incomplete draft URLs.
 *
 * @param url - Resolved request URL.
 * @returns Hostname for cookie lookup, or null when parsing fails.
 */
function resolveCookieDomain(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Returns whether script execution could have changed cookies.
 *
 * @param input - Input whose scripts determine whether cookie work occurred.
 * @param cookies - Final cookie state.
 * @returns True when scripts were supplied and cookies can be persisted.
 */
function hasScriptCookieChanges(input: RunRequestInput, cookies: KeyValue[]): boolean {
  return (input.scripts?.length ?? 0) > 0 && cookies.length >= 0;
}

/**
 * Produces the synthetic result used when a pre-request script skips HTTP.
 *
 * @returns Skipped response compatible with normal send outcomes.
 */
function skippedResult(): SendResult {
  return {
    status: 0,
    statusText: 'Skipped',
    headers: {},
    body: '',
    timeMs: 0,
    sizeBytes: 0,
    error: 'Request skipped by script'
  };
}

/**
 * Converts an unexpected runner exception to a normal send result.
 *
 * @param error - Exception thrown by a dependency or orchestration step.
 * @returns Error response compatible with normal send outcomes.
 */
function errorResult(error: unknown): SendResult {
  return {
    status: 0,
    statusText: 'Error',
    headers: {},
    body: '',
    timeMs: 0,
    sizeBytes: 0,
    error: error instanceof Error ? error.message : String(error)
  };
}

/**
 * Shapes all successful, skipped, and failed runs consistently.
 *
 * @param response - HTTP or synthetic response.
 * @param sendInput - Prepared request when transport was invoked.
 * @param testResults - Aggregated test assertions.
 * @param scriptLogs - Aggregated script logs.
 * @param executionEvents - Aggregated variable and flow events.
 * @param scriptErrors - Aggregated script errors.
 * @param scriptNextRequest - Script-selected collection-run target.
 * @param scriptSkipRequest - Whether pre scripts skipped transport.
 * @param workflowNextAction - Workflow next-action directive from scripts.
 * @param workflowSkipAction - Whether scripts requested skipping the workflow action.
 * @returns Portable request run outcome.
 */
function buildResult(
  response: SendResult,
  sendInput: RunRequestResult['sendInput'],
  testResults: RunRequestResult['testResults'],
  scriptLogs: ScriptLogEntry[],
  executionEvents: RunRequestResult['executionEvents'],
  scriptErrors: string[],
  scriptNextRequest: string | null | undefined,
  scriptSkipRequest: boolean,
  workflowNextAction?: string,
  workflowSkipAction?: boolean
): RunRequestResult {
  return {
    response,
    ...(sendInput ? { sendInput } : {}),
    testResults,
    scriptLogs,
    executionEvents,
    ...(scriptErrors.length ? { scriptError: scriptErrors.join('\n') } : {}),
    ...(scriptNextRequest !== undefined ? { scriptNextRequest } : {}),
    scriptSkipRequest,
    ...(workflowNextAction !== undefined ? { workflowNextAction } : {}),
    ...(workflowSkipAction ? { workflowSkipAction: true } : {})
  };
}
