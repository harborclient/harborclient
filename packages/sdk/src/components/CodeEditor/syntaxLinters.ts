import { jsonParseLinter } from '@codemirror/lang-json';
import { syntaxTree } from '@codemirror/language';
import { type Diagnostic, linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { lintTooltipHideOn } from './lintTooltipHideOn.js';

/** Maximum wait before running deferred lint when the browser stays busy. */
const LINT_IDLE_TIMEOUT_MS = 500;

/**
 * Schedules work during browser idle time, with a timeout fallback for test environments.
 *
 * @param callback - Work to run when idle or after the timeout elapses.
 * @param timeout - Maximum milliseconds to wait before forcing the callback.
 * @returns Cancels the scheduled callback when invoked.
 */
function scheduleIdle(callback: () => void, timeout: number): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback, { timeout });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(callback, 0);
  return () => clearTimeout(handle);
}

/**
 * Collects Lezer parse-tree error nodes as CodeMirror diagnostics.
 *
 * @param view - CodeMirror editor view instance.
 */
function collectJavascriptSyntaxErrors(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  syntaxTree(view.state)
    .cursor()
    .iterate((node) => {
      if (node.type.isError) {
        diagnostics.push({
          from: node.from,
          to: node.to,
          severity: 'error',
          message: 'Syntax error'
        });
      }
    });
  return diagnostics;
}

/**
 * Returns a lint extension that underlines JavaScript syntax errors.
 *
 * Defers the syntax-tree walk to idle time so lint does not contend with
 * autocomplete on the main thread while typing in script editors.
 */
export function createJavascriptSyntaxLinter(): Extension {
  let cancelPending: (() => void) | null = null;

  return linter(
    (view) => {
      cancelPending?.();
      return new Promise<Diagnostic[]>((resolve) => {
        cancelPending = scheduleIdle(() => {
          cancelPending = null;
          resolve(collectJavascriptSyntaxErrors(view));
        }, LINT_IDLE_TIMEOUT_MS);
      });
    },
    { hideOn: lintTooltipHideOn }
  );
}

/**
 * Returns a lint extension that underlines JSON parse errors.
 */
export function createJsonSyntaxLinter(): Extension {
  return linter(jsonParseLinter(), { hideOn: lintTooltipHideOn });
}
