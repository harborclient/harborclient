import type { Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  hoverTooltip,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view';
import { buildVariableTooltipDom } from '@harborclient/sdk/components';
import { VARIABLE_NAME_CHARS } from '@harborclient/sdk/variables';
import type { Variable } from '#/shared/types';

const variableMatcher = new MatchDecorator({
  regexp: new RegExp(`\\{\\{\\s*([${VARIABLE_NAME_CHARS}]+)\\s*\\}\\}`, 'g'),
  decoration: Decoration.mark({ class: 'cm-variable-token' })
});

/**
 * Recomputes {{variable}} mark decorations when CodeMirror document content changes.
 */
const variableHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    /**
     * Builds the initial decoration set for a CodeMirror view.
     *
     * @param view - CodeMirror editor view instance.
     */
    constructor(view: EditorView) {
      this.decorations = variableMatcher.createDeco(view);
    }

    /**
     * Updates decorations after document or viewport changes.
     *
     * @param update - View update describing what changed.
     */
    update(update: ViewUpdate): void {
      this.decorations = variableMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

/**
 * Finds the {{variable}} token at a document position, if any.
 *
 * @param doc - CodeMirror document.
 * @param pos - Character position in the document.
 * @returns Variable key and token range, or null when not inside a token.
 */
function findVariableAtPos(
  doc: { lineAt: (pos: number) => { from: number; text: string } },
  pos: number
): { key: string; start: number; end: number } | null {
  const line = doc.lineAt(pos);
  const pattern = new RegExp(`\\{\\{\\s*([${VARIABLE_NAME_CHARS}]+)\\s*\\}\\}`, 'g');

  for (const match of line.text.matchAll(pattern)) {
    const start = line.from + (match.index ?? 0);
    const end = start + match[0].length;
    if (pos < start || pos > end) {
      continue;
    }
    return { key: match[1], start, end };
  }

  return null;
}

/**
 * Builds a hover tooltip extension for {{variable}} tokens in CodeMirror.
 *
 * @param variables - Collection-scoped variables for resolution.
 * @param onEditVariable - Optional callback to open collection settings.
 */
function variableTooltipExtension(
  variables: Variable[],
  onEditVariable?: (key: string) => void
): ReturnType<typeof hoverTooltip> {
  return hoverTooltip((view, pos) => {
    const match = findVariableAtPos(view.state.doc, pos);
    if (!match) {
      return null;
    }

    return {
      pos: match.start,
      end: match.end,
      above: true,
      create() {
        return { dom: buildVariableTooltipDom(match.key, variables, onEditVariable) };
      }
    };
  });
}

/**
 * Returns CodeMirror extensions that highlight {{variable}} tokens and show hover tooltips.
 *
 * @param variables - Collection-scoped variables for resolution.
 * @param onEditVariable - Optional callback to open collection settings.
 */
export function createVariableCodeMirrorExtensions(
  variables: Variable[],
  onEditVariable?: (key: string) => void
): Extension[] {
  return [variableHighlighter, variableTooltipExtension(variables, onEditVariable)];
}
