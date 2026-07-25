import { describe, expect, it } from 'vitest';
import type { ScriptRunError, ScriptTestResult } from '@harborclient/core/types';
import {
  computeTestResultsRevealNonce,
  findFailedRequestScriptTest,
  findScriptErrorForRow,
  revealStateForScriptRow,
  revealStateFromScriptError,
  revealStateFromTest
} from './scriptTestReveal';

function testRow(overrides: Partial<ScriptTestResult> = {}): ScriptTestResult {
  return {
    name: 'Status code is 2xx',
    passed: false,
    error: 'expected false to be truthy',
    line: 3,
    column: 67,
    scriptId: 'script-1',
    phase: 'post',
    scope: 'request',
    ...overrides
  };
}

function errorRow(overrides: Partial<ScriptRunError> = {}): ScriptRunError {
  return {
    message: 'script.js:2:7: boom',
    scriptName: 'Request post-request',
    scriptId: 'script-1',
    phase: 'post',
    scope: 'request',
    source: 'script.js',
    line: 2,
    column: 7,
    ...overrides
  };
}

describe('findFailedRequestScriptTest', () => {
  it('matches a failed request-scoped test by phase and script id', () => {
    const results = [testRow(), testRow({ scriptId: 'other', phase: 'pre', passed: true })];

    expect(findFailedRequestScriptTest(results, 'post', 'script-1')).toEqual(results[0]);
  });

  it('ignores collection-scoped and passed tests', () => {
    const results = [testRow({ scope: 'collection' }), testRow({ passed: true })];

    expect(findFailedRequestScriptTest(results, 'post', 'script-1')).toBeUndefined();
  });
});

describe('findScriptErrorForRow', () => {
  it('matches a request-scoped error by phase and script id', () => {
    const errors = [errorRow(), errorRow({ scriptId: 'other', phase: 'pre' })];

    expect(findScriptErrorForRow(errors, 'post', 'script-1')).toEqual(errors[0]);
  });

  it('ignores collection- and folder-scoped errors', () => {
    const errors = [errorRow({ scope: 'collection' }), errorRow({ scope: 'folder' })];

    expect(findScriptErrorForRow(errors, 'post', 'script-1')).toBeUndefined();
  });
});

describe('revealStateFromTest', () => {
  it('returns line, column, and message for a failed mappable test', () => {
    expect(revealStateFromTest(testRow())).toEqual({
      line: 3,
      column: 67,
      message: 'expected false to be truthy',
      source: 'test'
    });
  });

  it('returns undefined when line is missing', () => {
    expect(revealStateFromTest(testRow({ line: undefined }))).toBeUndefined();
  });

  it('uses a fallback message when error is blank', () => {
    expect(revealStateFromTest(testRow({ error: '   ' }))?.message).toBe('Assertion failed');
  });
});

describe('revealStateFromScriptError', () => {
  it('returns line, column, and message for a located error', () => {
    expect(revealStateFromScriptError(errorRow())).toEqual({
      line: 2,
      column: 7,
      message: 'script.js:2:7: boom',
      source: 'script'
    });
  });

  it('returns undefined when the error location did not map', () => {
    expect(revealStateFromScriptError(errorRow({ line: undefined }))).toBeUndefined();
    expect(revealStateFromScriptError(undefined)).toBeUndefined();
  });

  it('uses a fallback message when the message is blank', () => {
    expect(revealStateFromScriptError(errorRow({ message: '   ' }))?.message).toBe('Script error');
  });
});

describe('revealStateForScriptRow', () => {
  it('prefers a script error over a failed test on the same row', () => {
    expect(revealStateForScriptRow([errorRow()], [testRow()], 'post', 'script-1')).toEqual({
      line: 2,
      column: 7,
      message: 'script.js:2:7: boom',
      source: 'script'
    });
  });

  it('falls back to a failed test when no script error maps', () => {
    expect(revealStateForScriptRow([], [testRow()], 'post', 'script-1')).toEqual({
      line: 3,
      column: 67,
      message: 'expected false to be truthy',
      source: 'test'
    });
  });

  it('returns undefined when neither error nor test applies', () => {
    expect(revealStateForScriptRow([], [], 'post', 'script-1')).toBeUndefined();
    expect(
      revealStateForScriptRow(
        [errorRow({ scriptId: 'other' })],
        [testRow({ scriptId: 'other' })],
        'post',
        'script-1'
      )
    ).toBeUndefined();
  });
});

describe('computeTestResultsRevealNonce', () => {
  it('returns undefined when no mappable request failures exist', () => {
    expect(computeTestResultsRevealNonce([])).toBeUndefined();
    expect(computeTestResultsRevealNonce([testRow({ line: undefined })])).toBeUndefined();
    expect(computeTestResultsRevealNonce([testRow({ scope: 'collection' })])).toBeUndefined();
  });

  it('changes when failure details change', () => {
    const first = computeTestResultsRevealNonce([testRow()]);
    const second = computeTestResultsRevealNonce([testRow({ line: 4 })]);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('includes script errors in the nonce', () => {
    const withoutError = computeTestResultsRevealNonce([testRow()]);
    const withError = computeTestResultsRevealNonce([testRow()], [errorRow()]);
    expect(withError).toBeDefined();
    expect(withError).not.toBe(withoutError);
  });

  it('returns a nonce when only script errors exist', () => {
    expect(computeTestResultsRevealNonce([], [errorRow()])).toBeDefined();
    expect(computeTestResultsRevealNonce([], [errorRow({ line: undefined })])).toBeUndefined();
    expect(computeTestResultsRevealNonce([], [errorRow({ scope: 'collection' })])).toBeUndefined();
  });
});
