import type { ScriptPhase } from '@harborclient/sdk';
import type { BodyType, HttpMethod, KeyValue } from '#/shared/types/common';
import type { SendResult } from '#/shared/types/request';

/**
 * A single script entry in an ordered pre/post request script list.
 */
export interface ScriptRef {
  /**
   * Stable list key used for reordering and React keys.
   */
  id: string;

  /**
   * When false, the script is skipped at send time.
   */
  enabled: boolean;

  /**
   * Inline JavaScript source or a live reference to a saved snippet.
   */
  kind: 'inline' | 'snippet';

  /**
   * Optional display label for inline scripts.
   */
  name?: string;

  /**
   * JavaScript source when {@link kind} is `inline`.
   */
  code?: string;

  /**
   * Snippet {@link Snippet.uuid} when {@link kind} is `snippet`.
   */
  snippetUuid?: string;

  /**
   * When true, the script editor body is expanded in the list UI.
   */
  expanded?: boolean;
}

/**
 * Request context passed into a pre/post script sandbox.
 */
export interface ScriptRequestContext {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: BodyType;
}

/**
 * Collection context passed into a pre/post script sandbox.
 */
export interface ScriptCollectionContext {
  /**
   * Collection database id, or null when the request has no collection.
   */
  id: number | null;
  /**
   * Display name of the collection, or empty when none is associated.
   */
  name: string;
  /**
   * Raw collection headers (unsubstituted {{var}} values).
   */
  headers: KeyValue[];
}

/**
 * Environment context passed into a pre/post script sandbox.
 */
export interface ScriptEnvironmentContext {
  /**
   * Active environment display name, or empty when none is active.
   */
  name: string;
}

/**
 * Input for running a pre/post script in the main process sandbox.
 */
export interface ScriptRunInput {
  phase: ScriptPhase;
  script: string;
  request: ScriptRequestContext;
  response?: SendResult;
  variables: Record<string, string>;
  /**
   * Active collection metadata and headers when the request belongs to a collection.
   */
  collection?: ScriptCollectionContext;
  /**
   * Active environment metadata when an environment is selected.
   */
  environment?: ScriptEnvironmentContext;
}

/**
 * Result of a single hc.test assertion.
 */
export interface ScriptTestResult {
  name: string;
  passed: boolean;
  error?: string;
  /**
   * Display label of the pre/post script that produced this assertion.
   */
  scriptName?: string;
}

/**
 * Result returned from the script sandbox after execution.
 */
export interface ScriptRunResult {
  request: ScriptRequestContext;
  variableSets: Record<string, string>;
  /**
   * Values set via hc.collection.variables.set; persisted to the collection after send.
   */
  collectionVariableSets: Record<string, string>;
  /**
   * Collection headers after hc.collection.headers mutations; persisted after send.
   */
  collectionHeaders: KeyValue[];
  /**
   * Values set via hc.environment.variables.set; persisted to the active environment after send.
   */
  environmentVariableSets: Record<string, string>;
  /**
   * Values set via hc.globals.set; persisted to app global variables after send.
   */
  globalVariableSets: Record<string, string>;
  tests: ScriptTestResult[];
  logs: string[];
  error?: string;
}
