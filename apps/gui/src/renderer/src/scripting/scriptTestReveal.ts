import type { ScriptRunError, ScriptTestResult } from '@harborclient/core/types';

/**
 * Origin of a reveal marker: a failed hc.test assertion or a script
 * runtime/compile error. Forwarded to CodeMirror as the diagnostic source.
 */
export type ScriptRevealSource = 'test' | 'script';

/**
 * Reveal fields derived from a failed hc.test result or script error for
 * inline script editors.
 */
export interface ScriptTestReveal {
  /**
   * 1-based mapped line of the failing assertion or error.
   */
  line: number;

  /**
   * Optional 1-based mapped column of the failing assertion or error.
   */
  column?: number;

  /**
   * Failure message shown in the CodeMirror lint tooltip.
   */
  message: string;

  /**
   * Whether this reveal came from a test failure or a script error.
   */
  source: ScriptRevealSource;
}

/**
 * Returns the first failed request-scoped test for a script row in a phase.
 *
 * @param testResults - hc.test results from the last send on the owning request tab.
 * @param phase - Pre- or post-request stage of the script list being rendered.
 * @param scriptId - Stable {@link ScriptRef.id} of the script row.
 * @returns Matching failed test, or undefined when none apply to this row.
 */
export function findFailedRequestScriptTest(
  testResults: readonly ScriptTestResult[],
  phase: 'pre' | 'post',
  scriptId: string
): ScriptTestResult | undefined {
  return testResults.find(
    (test) =>
      !test.passed && test.scope === 'request' && test.phase === phase && test.scriptId === scriptId
  );
}

/**
 * Returns the first request-scoped script error for a script row in a phase.
 *
 * @param scriptErrors - Structured script failures from the last send on the owning request tab.
 * @param phase - Pre- or post-request stage of the script list being rendered.
 * @param scriptId - Stable {@link ScriptRef.id} of the script row.
 * @returns Matching script error, or undefined when none apply to this row.
 */
export function findScriptErrorForRow(
  scriptErrors: readonly ScriptRunError[],
  phase: 'pre' | 'post',
  scriptId: string
): ScriptRunError | undefined {
  return scriptErrors.find(
    (error) => error.scope === 'request' && error.phase === phase && error.scriptId === scriptId
  );
}

/**
 * Builds reveal props for a script editor row from a failed test result.
 *
 * @param test - Failed test result, or undefined when the row has no failure.
 * @returns Reveal line/column/message when mappable, otherwise undefined.
 */
export function revealStateFromTest(
  test: ScriptTestResult | undefined
): ScriptTestReveal | undefined {
  if (test == null || test.passed) {
    return undefined;
  }

  if (test.line == null || !Number.isFinite(test.line)) {
    return undefined;
  }

  return {
    line: test.line,
    column: test.column,
    message: test.error?.trim() || 'Assertion failed',
    source: 'test'
  };
}

/**
 * Builds reveal props for a script editor row from a script runtime or
 * compile error.
 *
 * @param error - Structured script failure, or undefined when the row has none.
 * @returns Reveal line/column/message when the error location mapped, otherwise undefined.
 */
export function revealStateFromScriptError(
  error: ScriptRunError | undefined
): ScriptTestReveal | undefined {
  if (error == null) {
    return undefined;
  }

  if (error.line == null || !Number.isFinite(error.line)) {
    return undefined;
  }

  return {
    line: error.line,
    column: error.column,
    message: error.message.trim() || 'Script error',
    source: 'script'
  };
}

/**
 * Derives reveal props for one script row from the last send's failures.
 *
 * A throw aborts the script, so a script error takes precedence over a failed
 * assertion on the same row.
 *
 * @param scriptErrors - Structured script failures from the last send.
 * @param testResults - hc.test results from the last send.
 * @param phase - Pre- or post-request stage of the script list being rendered.
 * @param scriptId - Stable {@link ScriptRef.id} of the script row.
 * @returns Reveal line/column/message when a mappable failure exists for this row.
 */
export function revealStateForScriptRow(
  scriptErrors: readonly ScriptRunError[],
  testResults: readonly ScriptTestResult[],
  phase: 'pre' | 'post',
  scriptId: string
): ScriptTestReveal | undefined {
  return (
    revealStateFromScriptError(findScriptErrorForRow(scriptErrors, phase, scriptId)) ??
    revealStateFromTest(findFailedRequestScriptTest(testResults, phase, scriptId))
  );
}

/**
 * Mixes a string into a 32-bit accumulator hash.
 *
 * @param hash - Current accumulator value.
 * @param key - String to fold into the hash.
 * @returns Updated accumulator.
 */
function mixHash(hash: number, key: string): number {
  let next = hash;
  for (let index = 0; index < key.length; index++) {
    next = Math.imul(31, next) + key.charCodeAt(index);
    next |= 0;
  }
  return next;
}

/**
 * Stable nonce that changes whenever request-scoped test failures or script
 * errors change.
 *
 * Passed to script rows so dismiss-on-edit resets after a new send even when the
 * failure count stays the same.
 *
 * @param testResults - hc.test results from the last send on the owning request tab.
 * @param scriptErrors - Structured script failures from the same send.
 * @returns Hash nonce when at least one mappable request failure exists.
 */
export function computeTestResultsRevealNonce(
  testResults: readonly ScriptTestResult[],
  scriptErrors: readonly ScriptRunError[] = []
): number | undefined {
  let hash = 0;
  let hasReveal = false;

  for (const test of testResults) {
    if (test.passed || test.scope !== 'request' || !test.scriptId || !test.phase) {
      continue;
    }
    if (test.line == null || !Number.isFinite(test.line)) {
      continue;
    }

    hasReveal = true;
    hash = mixHash(
      hash,
      `test\0${test.phase}\0${test.scriptId}\0${test.name}\0${test.line}\0${test.column ?? ''}\0${test.error ?? ''}`
    );
  }

  for (const error of scriptErrors) {
    if (error.scope !== 'request' || !error.scriptId || !error.phase) {
      continue;
    }
    if (error.line == null || !Number.isFinite(error.line)) {
      continue;
    }

    hasReveal = true;
    hash = mixHash(
      hash,
      `error\0${error.phase}\0${error.scriptId}\0${error.line}\0${error.column ?? ''}\0${error.message}`
    );
  }

  return hasReveal ? hash : undefined;
}
