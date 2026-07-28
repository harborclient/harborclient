import { z } from 'zod';
import type { AuthConfig } from '../auth';
import type { HttpMethod, KeyValue } from './common';
import type { ScriptTestResult } from './script';

/**
 * One recorded step inside a workflow session or portable export.
 */
export interface WorkflowAction {
  /**
   * Stable identifier for this action; used when other actions refer to it.
   */
  uuid: string;

  /**
   * Stable logical event name (for example `request.load`).
   */
  type: string;

  /**
   * Wall-clock time when the action was recorded; optional in portable files.
   */
  at?: number;

  /**
   * Normalized action payload.
   */
  payload: unknown;
}

/**
 * Persisted workflow row from the local registry database.
 */
export interface Workflow {
  /**
   * Database primary key.
   */
  id: number;

  /**
   * Stable portable identifier for export/import.
   */
  uuid: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Accumulated recording duration in milliseconds.
   */
  durationMs: number;

  /**
   * Pause between consecutive actions during playback, in milliseconds.
   */
  delayMs: number;

  /**
   * Workflow-scoped variables for future parameterization.
   */
  variables: Record<string, string>;

  /**
   * Ordered recorded actions.
   */
  actions: WorkflowAction[];

  /**
   * Creation timestamp in milliseconds since epoch.
   */
  createdAt: number;

  /**
   * Last update timestamp in milliseconds since epoch.
   */
  updatedAt: number;
}

/**
 * Input for creating a workflow in the local registry.
 */
export interface CreateWorkflowInput {
  /**
   * Display name for the workflow.
   */
  name: string;

  /**
   * Optional portable uuid; generated when omitted.
   */
  uuid?: string;

  /**
   * Accumulated recording duration in milliseconds.
   */
  durationMs: number;

  /**
   * Optional pause between consecutive actions during playback, in milliseconds.
   * Defaults to 0 when omitted.
   */
  delayMs?: number;

  /**
   * Optional workflow variables; defaults to an empty object.
   */
  variables?: Record<string, string>;

  /**
   * Ordered recorded actions to persist.
   */
  actions: WorkflowAction[];
}

/**
 * Input for updating a workflow's actions and duration in the local registry.
 */
export interface UpdateWorkflowInput {
  /**
   * Database primary key of the workflow to update.
   */
  id: number;

  /**
   * Ordered recorded actions to persist.
   */
  actions: WorkflowAction[];

  /**
   * Accumulated recording duration in milliseconds.
   */
  durationMs: number;

  /**
   * Pause between consecutive actions during playback, in milliseconds.
   */
  delayMs: number;
}

/**
 * Notes block embedded in a workflow-run request result entry.
 */
export interface WorkflowRunRequestNotes {
  /**
   * Parsed request tags at send time.
   */
  tags: string[];

  /**
   * Free-form request comment at send time.
   */
  comment: string;
}

/**
 * Timing summary for a workflow-run request response.
 */
export interface WorkflowRunRequestTiming {
  /**
   * Total round-trip time in milliseconds.
   */
  totalTime: number;

  /**
   * Response body size in bytes when known.
   */
  size?: number;

  /**
   * Optional stalled phase duration in milliseconds.
   */
  stalledMs?: number;

  /**
   * Optional connect phase duration in milliseconds.
   */
  connectMs?: number;

  /**
   * Optional request-sent phase duration in milliseconds.
   */
  requestSentMs?: number;

  /**
   * Optional waiting (TTFB) phase duration in milliseconds.
   */
  waitingMs?: number;

  /**
   * Optional download phase duration in milliseconds.
   */
  downloadMs?: number;
}

/**
 * Response payload nested under a workflow-run request result entry.
 */
export interface WorkflowRunRequestResponse {
  /**
   * Response body as text, or base64 for binary / non-textual responses.
   */
  body: string;

  /**
   * Response headers as key/value rows.
   */
  headers: KeyValue[];

  /**
   * Timing summary for the send.
   */
  timing: WorkflowRunRequestTiming;

  /**
   * hc.test assertion results from the send.
   */
  tests: ScriptTestResult[];

  /**
   * Final `hc.data` bag after pre/post scripts for this send.
   */
  data: Record<string, unknown>;
}

/**
 * Request+response snapshot recorded when a workflow `request.send` action runs.
 */
export interface WorkflowRunRequestResult {
  /**
   * Display name of the request at send time.
   */
  name: string;

  /**
   * Portable request uuid when the tab was a saved request; empty otherwise.
   */
  uuid: string;

  /**
   * HTTP method used for the send.
   */
  method: HttpMethod;

  /**
   * Request URL used for the send (prefer fully resolved when available).
   */
  url: string;

  /**
   * Outgoing request headers as key/value rows.
   */
  headers: KeyValue[];

  /**
   * Cookie jar rows applied for the request host at send time.
   */
  cookies: KeyValue[];

  /**
   * Request notes (tags and comment) at send time.
   */
  notes: WorkflowRunRequestNotes;

  /**
   * Request body as sent / drafted.
   */
  body: string;

  /**
   * Authorization config on the draft at send time.
   */
  authorization: AuthConfig;

  /**
   * Response, tests, timing, and `hc.data` from the completed send.
   */
  response: WorkflowRunRequestResponse;
}

/**
 * One entry in a workflow-run results export.
 *
 * Request sends use {@link WorkflowRunRequestResult}; other actions store their
 * recorded payload value directly.
 */
export type WorkflowRunActionResult = WorkflowRunRequestResult | unknown;

/**
 * Portable HarborClient workflow-run results export envelope.
 */
export interface WorkflowRunExport {
  /**
   * HarborClient export schema version.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a workflow-run results export.
   */
  harborclientExport: 'workflow-run';

  /**
   * Display name of the workflow that was run.
   */
  name: string;

  /**
   * Active environment uuid at run start, or empty when none was active.
   */
  environment: string;

  /**
   * ISO-8601 timestamp when the run started.
   */
  date_created: string;

  /**
   * Actions in exact execution order (including jumps / repeats).
   */
  actions: WorkflowRunActionResult[];
}

/**
 * Input for building a {@link WorkflowRunRequestResult} from a completed send.
 */
export interface BuildWorkflowRunRequestResultInput {
  /**
   * Display name of the request.
   */
  name: string;

  /**
   * Portable request uuid, or empty when unsaved.
   */
  uuid: string;

  /**
   * HTTP method.
   */
  method: HttpMethod;

  /**
   * Request URL.
   */
  url: string;

  /**
   * Outgoing headers.
   */
  headers: KeyValue[];

  /**
   * Cookies applied for the request host.
   */
  cookies: KeyValue[];

  /**
   * Comma-separated or already-parsed tags; normalized to a string array.
   */
  tags: string | string[];

  /**
   * Free-form request comment.
   */
  comment: string;

  /**
   * Request body text.
   */
  body: string;

  /**
   * Authorization config.
   */
  authorization: AuthConfig;

  /**
   * Response body text.
   */
  responseBody: string;

  /**
   * Response headers as a flat map or key/value rows.
   */
  responseHeaders: Record<string, string> | KeyValue[];

  /**
   * Total round-trip time in milliseconds.
   */
  timeMs: number;

  /**
   * Response body size in bytes.
   */
  sizeBytes?: number;

  /**
   * Optional phase timing breakdown.
   */
  timing?: {
    stalledMs?: number;
    connectMs?: number;
    requestSentMs?: number;
    waitingMs?: number;
    downloadMs?: number;
  };

  /**
   * hc.test results from the send.
   */
  tests: ScriptTestResult[];

  /**
   * Final `hc.data` bag.
   */
  data: Record<string, unknown>;
}

/**
 * Portable HarborClient workflow export envelope.
 */
export interface WorkflowExport {
  /**
   * HarborClient export schema version.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a workflow export.
   */
  harborclientExport: 'workflow';

  /**
   * Stable portable identifier.
   */
  uuid: string;

  /**
   * Display name for the workflow.
   */
  name: string;

  /**
   * Workflow-scoped variables.
   */
  variables: Record<string, string>;

  /**
   * Ordered recorded actions.
   */
  actions: WorkflowAction[];

  /**
   * Optional recording duration in milliseconds.
   */
  durationMs?: number;

  /**
   * Optional pause between consecutive actions during playback, in milliseconds.
   */
  delayMs?: number;
}

const workflowActionSchema = z.object({
  uuid: z.string().trim().min(1),
  type: z.string().trim().min(1),
  at: z.number().finite().optional(),
  payload: z.unknown()
});

/**
 * Zod schema for validating workflow export files.
 */
export const workflowExportSchema = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('workflow'),
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  variables: z.record(z.string(), z.string()).default({}),
  actions: z.array(workflowActionSchema),
  durationMs: z.number().finite().nonnegative().optional(),
  delayMs: z.number().finite().nonnegative().optional()
}) satisfies z.ZodType<WorkflowExport>;

/**
 * Validates a parsed workflow export payload.
 *
 * @param data - Unknown parsed JSON.
 * @returns Normalized workflow export.
 * @throws When validation fails.
 */
export function validateWorkflowExport(data: unknown): WorkflowExport {
  return workflowExportSchema.parse(data);
}

/**
 * Builds a portable workflow export envelope.
 *
 * @param input - Workflow fields to serialize.
 * @returns Workflow export object.
 */
export function buildWorkflowExport(input: {
  uuid: string;
  name: string;
  variables?: Record<string, string>;
  actions: WorkflowAction[];
  durationMs?: number;
  delayMs?: number;
}): WorkflowExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'workflow',
    uuid: input.uuid,
    name: input.name,
    variables: input.variables ?? {},
    actions: input.actions,
    ...(input.durationMs != null ? { durationMs: input.durationMs } : {}),
    ...(input.delayMs != null ? { delayMs: input.delayMs } : {})
  };
}

/**
 * Normalizes a workflow inter-step delay to a non-negative integer milliseconds value.
 *
 * @param value - Raw delay candidate.
 * @returns Clamped delay in milliseconds; invalid or missing values become 0.
 */
export function normalizeWorkflowDelayMs(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.floor(numeric);
}

/**
 * Converts a flat header map into key/value rows for workflow-run exports.
 *
 * @param headers - Flat response header map.
 * @returns Key/value rows preserving map insertion order.
 */
function headersRecordToKeyValues(headers: Record<string, string>): KeyValue[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value, enabled: true }));
}

/**
 * Normalizes tags input into a string array for workflow-run request notes.
 *
 * @param tags - Comma-separated string or already-parsed tags.
 * @returns Trimmed non-empty tag strings.
 */
function normalizeWorkflowRunTags(tags: string | string[]): string[] {
  if (Array.isArray(tags)) {
    return tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  }
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Builds a request+response entry for a workflow-run results export.
 *
 * @param input - Draft and send outcome fields captured at playback time.
 * @returns Portable request result entry.
 */
export function buildWorkflowRunRequestResult(
  input: BuildWorkflowRunRequestResultInput
): WorkflowRunRequestResult {
  const responseHeaders = Array.isArray(input.responseHeaders)
    ? input.responseHeaders.map((row) => ({ ...row }))
    : headersRecordToKeyValues(input.responseHeaders);

  const timing: WorkflowRunRequestTiming = {
    totalTime: input.timeMs,
    ...(input.sizeBytes != null ? { size: input.sizeBytes } : {})
  };
  if (input.timing?.stalledMs != null) {
    timing.stalledMs = input.timing.stalledMs;
  }
  if (input.timing?.connectMs != null) {
    timing.connectMs = input.timing.connectMs;
  }
  if (input.timing?.requestSentMs != null) {
    timing.requestSentMs = input.timing.requestSentMs;
  }
  if (input.timing?.waitingMs != null) {
    timing.waitingMs = input.timing.waitingMs;
  }
  if (input.timing?.downloadMs != null) {
    timing.downloadMs = input.timing.downloadMs;
  }

  return {
    name: input.name,
    uuid: input.uuid,
    method: input.method,
    url: input.url,
    headers: input.headers.map((row) => ({ ...row })),
    cookies: input.cookies.map((row) => ({ ...row })),
    notes: {
      tags: normalizeWorkflowRunTags(input.tags),
      comment: input.comment
    },
    body: input.body,
    authorization: structuredClone(input.authorization),
    response: {
      body: input.responseBody,
      headers: responseHeaders,
      timing,
      tests: input.tests.map((test) => ({ ...test })),
      data: { ...input.data }
    }
  };
}

/**
 * Builds a portable workflow-run results export envelope.
 *
 * @param input - Run metadata and ordered action results.
 * @returns Workflow-run export object.
 */
export function buildWorkflowRunExport(input: {
  name: string;
  environment?: string;
  date_created?: string;
  actions: WorkflowRunActionResult[];
}): WorkflowRunExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'workflow-run',
    name: input.name,
    environment: input.environment ?? '',
    date_created: input.date_created ?? new Date().toISOString(),
    actions: input.actions
  };
}
