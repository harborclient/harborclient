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
  parseAiScriptReferenceMatch,
  resolveAiScriptReferenceLabel,
  type AiScriptReferenceValidationContext
} from '#/shared/ai/scriptReferences';
import {
  createScriptReferenceBadgeElement,
  SCRIPT_REFERENCE_REMOVE_ATTR
} from './scriptReferenceBadgeDom';
import { createScriptReferenceCompletionFilter } from './scriptReferenceCompletionFilter';
import { getScriptReferenceRemovalRange } from './scriptReferenceRemoval';

/**
 * CodeMirror widget that renders a resolved script reference as a badge.
 */
class ScriptReferenceWidget extends WidgetType {
  /**
   * @param label - Resolved script display name.
   * @param from - Document start offset of the `@` reference token.
   * @param to - Document end offset (exclusive) of the `@` reference token.
   */
  constructor(
    private readonly label: string,
    private readonly from: number,
    private readonly to: number
  ) {
    super();
  }

  /**
   * Compares widget identity so identical badges can be reused across updates.
   */
  eq(other: ScriptReferenceWidget): boolean {
    return other.label === this.label && other.from === this.from && other.to === this.to;
  }

  /**
   * Builds the badge DOM node for the widget decoration, including a remove control.
   */
  toDOM(view: EditorView): HTMLElement {
    return createScriptReferenceBadgeElement(this.label, {
      onRemove: () => {
        const { from, to } = getScriptReferenceRemovalRange(view.state.doc, this.from, this.to);
        view.dispatch({
          changes: { from, to },
          selection: { anchor: from, head: from }
        });
      }
    });
  }

  /**
   * Keeps remove-button clicks from changing editor selection while allowing normal caret
   * placement elsewhere on the badge.
   */
  ignoreEvent(event: Event): boolean {
    const target = event.target;
    return target instanceof Element && target.closest(`[${SCRIPT_REFERENCE_REMOVE_ATTR}]`) != null;
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
 * Builds CodeMirror extensions that render valid `@` script references as atomic badges.
 *
 * @param getContext - Returns the latest active-tab state for semantic validation and labels.
 */
function createScriptReferenceHighlighter(
  getContext: () => AiScriptReferenceValidationContext
): Extension[] {
  const scriptReferenceMatcher = new MatchDecorator({
    regexp: new RegExp(AI_SCRIPT_REFERENCE_PATTERN.source, 'g'),
    decoration: (match, view, pos) => {
      if (!isScriptReferenceBoundaryAt(view.state.doc, pos)) {
        return null;
      }

      const parsed = parseAiScriptReferenceMatch(match, pos);
      if (parsed == null) {
        return null;
      }

      const context = getContext();
      const label = resolveAiScriptReferenceLabel(parsed, context);
      if (label == null) {
        return null;
      }

      return Decoration.replace({
        widget: new ScriptReferenceWidget(label, parsed.start, parsed.end),
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

  return [scriptReferencePlugin, atomicRanges, createScriptReferenceCompletionFilter(getContext)];
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
 * @param getContext - Returns the latest active-tab state for script reference resolution.
 */
export function createScriptReferenceBadgeExtensions(
  getContext: () => AiScriptReferenceValidationContext
): Extension[] {
  return createScriptReferenceHighlighter(getContext);
}

/**
 * Compartment used to refresh script-reference badge decorations when validation context changes.
 */
export const chatComposerBadgeCompartment = new Compartment();

/**
 * Compartment used to reconfigure composer submit shortcuts without rebuilding badge decorations.
 */
export const chatComposerSubmitCompartment = new Compartment();
