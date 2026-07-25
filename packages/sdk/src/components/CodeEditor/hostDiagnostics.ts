import { type Diagnostic, linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { lintTooltipHideOn } from './lintTooltipHideOn.js';

/**
 * One action shown in a host diagnostic lint tooltip or lint panel.
 */
export interface CodeEditorDiagnosticAction {
  /**
   * Visible action label, for example `Copy to chat (Ctrl+Shift+O)`.
   */
  name: string;

  /**
   * Invoked when the user activates the action. Receives the diagnostic's
   * current range, which may differ from the original host offsets after edits.
   */
  apply: (view: EditorView, from: number, to: number) => void;

  /**
   * Optional CSS class merged onto the action button.
   */
  markClass?: string;
}

/**
 * Host-supplied diagnostic marker for {@link CodeEditor}.
 *
 * Independent of the built-in syntax linter; used for assertion failures and
 * other application-level markers.
 */
export interface CodeEditorDiagnostic {
  /**
   * Inclusive start offset into the document.
   */
  from: number;

  /**
   * Exclusive end offset into the document.
   */
  to: number;

  /**
   * Tooltip and lint-panel message shown for this marker.
   */
  message: string;

  /**
   * Visual severity. Defaults to `error`.
   */
  severity?: 'error' | 'warning' | 'info';

  /**
   * Optional source label shown in the lint tooltip (for example `test`).
   */
  source?: string;

  /**
   * Optional actions rendered beneath the message in lint hover tooltips.
   */
  actions?: readonly CodeEditorDiagnosticAction[];
}

/**
 * Clamps and filters host diagnostics into CodeMirror {@link Diagnostic} values.
 *
 * Drops entries with an empty message or an inverted range after clamping.
 *
 * @param docLength - Current document length used to clamp offsets.
 * @param diagnostics - Raw host diagnostics from the `diagnostics` prop.
 * @returns Safe diagnostics ready for the lint extension.
 */
export function normalizeHostDiagnostics(
  docLength: number,
  diagnostics: readonly CodeEditorDiagnostic[]
): Diagnostic[] {
  const length = Math.max(0, Math.floor(docLength));
  const next: Diagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const message = diagnostic.message.trim();
    if (!message) {
      continue;
    }

    const from = Math.max(0, Math.min(length, Math.floor(diagnostic.from)));
    const to = Math.max(0, Math.min(length, Math.floor(diagnostic.to)));
    if (from > to) {
      continue;
    }

    next.push({
      from,
      to: Math.max(to, from),
      severity: diagnostic.severity ?? 'error',
      message,
      ...(diagnostic.source != null && diagnostic.source.trim()
        ? { source: diagnostic.source.trim() }
        : {}),
      ...(diagnostic.actions != null && diagnostic.actions.length > 0
        ? { actions: diagnostic.actions }
        : {})
    });
  }

  return next;
}

/**
 * Returns a lint extension that underlines host-supplied diagnostics.
 *
 * Coexists with the syntax linter because `@codemirror/lint` merges all
 * `linter()` sources before calling `setDiagnostics`.
 *
 * @param getDiagnostics - Stable getter reading the latest host diagnostics.
 * @returns CodeMirror lint extension.
 */
export function createHostDiagnosticsLinter(
  getDiagnostics: () => readonly CodeEditorDiagnostic[]
): Extension {
  return linter(
    (view) => {
      return normalizeHostDiagnostics(view.state.doc.length, getDiagnostics());
    },
    { hideOn: lintTooltipHideOn }
  );
}
