import 'ses';
import type { ScriptRunContextInput } from '#/main/scripting/scriptApi';
import { createScriptApi, defaultScriptContextInput } from '#/main/scripting/scriptApi';
import { sanitizeScriptErrorMessage } from '#/main/scripting/scriptEvaluator';

/**
 * Result of running a user script inside a plugin script context.
 */
export interface PluginScriptRunResult {
  /**
   * Last-expression value from the evaluated script, when execution succeeded.
   */
  value: unknown;

  /**
   * Request snapshot after hc.request mutations in this run.
   */
  request: ReturnType<ReturnType<typeof createScriptApi>['readResult']>['request'];

  /**
   * Ephemeral variable sets from hc.request.variables.set during this context lifetime.
   */
  variableSets: Record<string, string>;

  /**
   * Collection variable sets from hc.collection.variables.set.
   */
  collectionVariableSets: Record<string, string>;

  /**
   * Environment variable sets from hc.environment.variables.set.
   */
  environmentVariableSets: Record<string, string>;

  /**
   * Global variable sets from hc.globals.set.
   */
  globalVariableSets: Record<string, string>;

  /**
   * Collection headers after hc.collection.headers mutations.
   */
  collectionHeaders: ReturnType<
    ReturnType<typeof createScriptApi>['readResult']
  >['collectionHeaders'];

  /**
   * hc.test results accumulated across runs on this context.
   */
  tests: ReturnType<ReturnType<typeof createScriptApi>['readResult']>['tests'];

  /**
   * Captured console output across runs on this context.
   */
  logs: string[];

  /**
   * Mutable object bag after hc.data mutations in this context lifetime.
   */
  data: Record<string, unknown>;

  /**
   * Sanitized runtime error message when script evaluation throws.
   */
  error?: string;
}

/**
 * Mutable sandbox for running scripts with the same hc API as pre/post request scripts.
 */
export interface PluginScriptContext {
  /**
   * Injects a global variable visible to subsequent run() calls.
   *
   * @param name - Global name exposed inside the compartment.
   * @param value - Value assigned to the global.
   */
  setVariable(name: string, value: unknown): void;

  /**
   * Injects a global function visible to subsequent run() calls.
   *
   * Overrides built-in globals such as console when names collide.
   *
   * @param name - Global name exposed inside the compartment.
   * @param fn - Callable injected into the sandbox.
   */
  setFunction(name: string, fn: (...args: unknown[]) => unknown): void;

  /**
   * Evaluates a script synchronously and returns hc mutations plus the last expression value.
   *
   * @param script - User-authored JavaScript evaluated as the compartment body.
   * @returns Full hc result snapshot with the script's return value.
   */
  run(script: string): PluginScriptRunResult;
}

/**
 * Returns whether a user script contains a real return statement (not a comment).
 *
 * @param source - Raw user-authored script source.
 */
function scriptUsesReturnStatement(source: string): boolean {
  return /^\s*return\b/m.test(source);
}

/**
 * Creates a plugin script sandbox backed by the shared hc factory.
 *
 * @param init - Optional request/response/variable context seeding hc.* APIs.
 * @returns Context with setVariable, setFunction, and run.
 */
export function createScriptContext(init?: Partial<ScriptRunContextInput>): PluginScriptContext {
  const defaults = defaultScriptContextInput();
  const merged: ScriptRunContextInput = {
    phase: init?.phase ?? defaults.phase,
    request: init?.request ?? defaults.request,
    response: init?.response,
    variables: init?.variables ?? defaults.variables,
    collection: init?.collection,
    environment: init?.environment,
    data: init?.data
  };

  const api = createScriptApi(merged);
  const injected: Record<string, unknown> = {};

  return {
    setVariable: (name, value) => {
      injected[String(name)] = value;
    },
    setFunction: (name, fn) => {
      injected[String(name)] = fn;
    },
    run: (script) => {
      const source = String(script).trim();
      const compartment = new Compartment({
        globals: {
          hc: api.hc,
          console: api.console,
          Date,
          Math,
          ...injected
        },
        __options__: true
      });

      if (!source) {
        return { ...api.readResult(), value: undefined };
      }

      // Top-level `return` is illegal in compartment script goal; wrap in an IIFE when
      // the user script uses `return`. Otherwise preserve last-expression completion.
      const evaluatedSource = scriptUsesReturnStatement(source)
        ? `(function() {\n${source}\n})()`
        : source;

      try {
        const value = compartment.evaluate(evaluatedSource);
        return { ...api.readResult(), value };
      } catch (err) {
        const rawMessage =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
        return {
          ...api.readResult(),
          value: undefined,
          error: sanitizeScriptErrorMessage(rawMessage)
        };
      }
    }
  };
}
