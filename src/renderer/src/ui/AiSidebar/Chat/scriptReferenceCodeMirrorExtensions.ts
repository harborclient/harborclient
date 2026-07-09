import { Compartment, Prec, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
  keymap,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view';
import {
  AI_SCRIPT_REFERENCE_PATTERN,
  resolveAiScriptReferenceName,
  type AiScriptReferenceValidationContext,
  type ParsedAiScriptReference
} from '#/shared/ai/scriptReferences';
import { createScriptReferenceBadgeElement } from './scriptReferenceBadgeDom';
import { createScriptReferenceCompletionFilter } from './scriptReferenceCompletionFilter';

/**
 * CodeMirror widget that renders a resolved script reference as a badge.
 */
class ScriptReferenceWidget extends WidgetType {
  /**
   * @param label - Resolved script display name.
   */
  constructor(private readonly label: string) {
    super();
  }

  /**
   * Compares widget labels so identical badges can be reused across updates.
   */
  eq(other: ScriptReferenceWidget): boolean {
    return other.label === this.label;
  }

  /**
   * Builds the badge DOM node for the widget decoration.
   */
  toDOM(): HTMLElement {
    return createScriptReferenceBadgeElement(this.label);
  }

  /**
   * Allows the editor to receive pointer events around the widget normally.
   */
  ignoreEvent(): boolean {
    return false;
  }

  /**
   * Maps cursor positions beside the badge so the caret appears after the widget.
   *
   * @param dom - Rendered badge element.
   * @param _pos - Offset into the widget (unused for inline badges).
   * @param side - Negative for positions before the widget, positive for after.
   */
  coordsAt(
    dom: HTMLElement,
    _pos: number,
    side: number
  ): {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } {
    const rect = dom.getBoundingClientRect();
    if (side <= 0) {
      return { left: rect.left, right: rect.left, top: rect.top, bottom: rect.bottom };
    }

    return { left: rect.right, right: rect.right, top: rect.top, bottom: rect.bottom };
  }
}

/**
 * Returns whether `@` at `index` is at a token boundary in the document.
 *
 * @param doc - CodeMirror document.
 * @param index - Index of the `@` character.
 */
function isScriptReferenceBoundaryAt(doc: EditorView['state']['doc'], index: number): boolean {
  if (index === 0) {
    return true;
  }

  const previous = doc.sliceString(index - 1, index);
  return /\s/.test(previous);
}

/**
 * Parses one regex match into a structured script reference.
 *
 * @param match - RegExp match for {@link AI_SCRIPT_REFERENCE_PATTERN}.
 * @param start - Document start offset of the match.
 */
function parseScriptReferenceMatch(
  match: RegExpExecArray,
  start: number
): ParsedAiScriptReference | null {
  const text = match[0];
  const requestIdRaw = match[1];
  const phase = match[2];
  const scriptIndexRaw = match[3];

  if (requestIdRaw == null || phase == null || scriptIndexRaw == null) {
    return null;
  }

  if (phase !== 'pre' && phase !== 'post') {
    return null;
  }

  const scriptIndex = Number(scriptIndexRaw);
  if (!Number.isInteger(scriptIndex) || scriptIndex < 1) {
    return null;
  }

  const requestId =
    requestIdRaw === 'active'
      ? 'active'
      : Number.isFinite(Number(requestIdRaw))
        ? Number(requestIdRaw)
        : null;

  if (requestId == null) {
    return null;
  }

  return {
    requestId,
    phase,
    scriptIndex,
    start,
    end: start + text.length,
    text
  };
}

/**
 * Builds CodeMirror extensions that render valid `@` script references as atomic badges.
 *
 * @param context - Active tab state for semantic validation and name resolution.
 */
function createScriptReferenceHighlighter(context: AiScriptReferenceValidationContext): Extension {
  const scriptReferenceMatcher = new MatchDecorator({
    regexp: new RegExp(AI_SCRIPT_REFERENCE_PATTERN.source, 'g'),
    decoration: (match, view, pos) => {
      if (!isScriptReferenceBoundaryAt(view.state.doc, pos)) {
        return null;
      }

      const parsed = parseScriptReferenceMatch(match, pos);
      if (parsed == null) {
        return null;
      }

      const label = resolveAiScriptReferenceName(parsed, context);
      if (label == null) {
        return null;
      }

      return Decoration.replace({
        widget: new ScriptReferenceWidget(label),
        inclusive: false,
        side: 1
      });
    }
  });

  const scriptReferencePlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      /**
       * Builds the initial decoration set for a CodeMirror view.
       *
       * @param view - CodeMirror editor view instance.
       */
      constructor(view: EditorView) {
        this.decorations = scriptReferenceMatcher.createDeco(view);
      }

      /**
       * Updates decorations after document or viewport changes.
       *
       * @param update - View update describing what changed.
       */
      update(update: ViewUpdate): void {
        this.decorations = scriptReferenceMatcher.updateDeco(update, this.decorations);
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );

  const atomicRanges = EditorView.atomicRanges.of((view) => {
    return view.plugin(scriptReferencePlugin)?.decorations ?? Decoration.none;
  });

  return [scriptReferencePlugin, atomicRanges, createScriptReferenceCompletionFilter(context)];
}

interface SubmitKeymapOptions {
  /**
   * When true, plain Enter submits instead of inserting a newline.
   */
  enterToSend: boolean;

  /**
   * Whether submission is currently allowed.
   */
  canSubmit: boolean;

  /**
   * Called when the configured submit shortcut is pressed.
   */
  onSubmit: () => void;
}

/**
 * Returns a high-priority keymap that submits the chat composer on Enter or Mod-Enter.
 *
 * @param options - Submit shortcut configuration and callback.
 */
export function createSubmitKeymap(options: SubmitKeymapOptions): Extension {
  const { enterToSend, canSubmit, onSubmit } = options;

  return Prec.highest(
    keymap.of([
      {
        key: 'Enter',
        run: () => {
          if (enterToSend && canSubmit) {
            onSubmit();
            return true;
          }
          return false;
        }
      },
      {
        key: 'Mod-Enter',
        run: () => {
          if (!enterToSend && canSubmit) {
            onSubmit();
            return true;
          }
          return false;
        }
      }
    ])
  );
}

/**
 * Returns CodeMirror extensions that render valid `@` script references as atomic badges.
 *
 * @param context - Active tab state for script reference resolution.
 */
export function createScriptReferenceBadgeExtensions(
  context: AiScriptReferenceValidationContext
): Extension[] {
  return [createScriptReferenceHighlighter(context)];
}

/**
 * Compartment used to reconfigure composer submit shortcuts without rebuilding badge decorations.
 */
export const chatComposerSubmitCompartment = new Compartment();
