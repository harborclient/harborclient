import type { CodeEditorDiagnostic } from '@harborclient/sdk/components';
import { lineColToSelection } from './lineColToSelection';

/**
 * Matches the `source:line:column: ` prefix that formatLocatedScriptError (core
 * scripting/scriptSourceMap) prepends to located script errors.
 *
 * Kept local because that module imports `node:module` and cannot be bundled
 * into the renderer.
 */
const LOCATED_ERROR_PREFIX_RE = /^[^:\s][^:\n]*:\d+:\d+:\s+/;

/**
 * Optional Copy to chat action embedded in a reveal diagnostic lint tooltip.
 */
export interface RevealDiagnosticCopyToChat {
  /**
   * Visible action label, for example `Copy to chat (Ctrl+Shift+O)`.
   */
  label: string;

  /**
   * Invoked with the diagnostic span when the user activates the action.
   */
  onSelect: (range: { from: number; to: number }) => void;
}

/**
 * Builds a single host diagnostic covering the same span as the reveal selection.
 *
 * Reuses {@link lineColToSelection} so the error squiggle lines up exactly with
 * the selected `hc.expect(...)` call (or the whole line when no expect is found).
 *
 * Script error messages arrive with a `source:line:column:` prefix; the tooltip
 * drops it because the underline already marks the exact location.
 *
 * @param source - Script source currently shown in the editor.
 * @param line - 1-based mapped line from the test result or script error.
 * @param column - Optional 1-based mapped column from the test result or script error.
 * @param message - Failure message shown in the lint tooltip.
 * @param diagnosticSource - Marker origin: `test` for assertion failures,
 *   `script` for runtime/compile errors. Defaults to `test`.
 * @param copyToChat - When provided, adds a lint-tooltip action for Copy to chat.
 * @returns A one-element diagnostics array, or `undefined` when there is no message.
 */
export function buildRevealDiagnostics(
  source: string,
  line: number | undefined,
  column: number | undefined,
  message: string | undefined,
  diagnosticSource: 'test' | 'script' = 'test',
  copyToChat?: RevealDiagnosticCopyToChat
): CodeEditorDiagnostic[] | undefined {
  const trimmed = message?.trim();
  if (!trimmed || line == null || !Number.isFinite(line)) {
    return undefined;
  }

  const selection = lineColToSelection(source, line, column);
  const from = Math.min(selection.anchor, selection.head);
  const to = Math.max(selection.anchor, selection.head);
  const tooltipMessage =
    diagnosticSource === 'script' ? trimmed.replace(LOCATED_ERROR_PREFIX_RE, '') : trimmed;

  const diagnostic: CodeEditorDiagnostic = {
    from,
    to,
    message: tooltipMessage,
    severity: 'error',
    source: diagnosticSource
  };

  if (copyToChat != null) {
    diagnostic.actions = [
      {
        name: copyToChat.label,
        apply: (_view, actionFrom, actionTo) => {
          copyToChat.onSelect({ from: actionFrom, to: actionTo });
        }
      }
    ];
  }

  return [diagnostic];
}
