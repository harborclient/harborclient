import type { Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view';
import {
  type RenderHighlightedPlaceholderOptions,
  renderHighlightedPlaceholderDom
} from './renderHighlightedPlaceholder.js';

/**
 * Options for building a muted syntax-highlighted placeholder layer.
 */
export type SyntaxHighlightedPlaceholderOptions = RenderHighlightedPlaceholderOptions;

/**
 * Flat, pre-highlighted placeholder markup inserted when the parent editor is empty.
 */
class SyntaxHighlightedPlaceholderWidget extends WidgetType {
  /**
   * @param text - Placeholder document shown when the parent editor is empty.
   * @param options - Highlighting and theme options shared with the parent editor.
   */
  constructor(
    private readonly text: string,
    private readonly options: SyntaxHighlightedPlaceholderOptions
  ) {
    super();
  }

  /**
   * Returns statically rendered placeholder DOM without nested editor chrome.
   */
  toDOM(): HTMLElement {
    return renderHighlightedPlaceholderDom(this.text, this.options);
  }

  /**
   * Prevents the placeholder layer from intercepting pointer events meant for the parent editor.
   */
  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * Returns whether focus currently lives inside the editor's DOM subtree.
 *
 * @param view - Parent CodeMirror editor view.
 */
function isEditorDomFocused(view: EditorView): boolean {
  const active = view.root.activeElement;
  if (active == null) {
    return false;
  }
  return view.dom.contains(active);
}

/**
 * Returns whether the syntax-highlighted placeholder should be visible.
 *
 * @param view - Parent CodeMirror editor view.
 * @param engaged - True after the user pressed inside the editor chrome.
 */
export function shouldShowSyntaxPlaceholder(view: EditorView, engaged: boolean): boolean {
  if (view.state.doc.length > 0) {
    return false;
  }
  if (engaged || isEditorDomFocused(view)) {
    return false;
  }
  return true;
}

/**
 * Builds widget decorations for the muted placeholder layer.
 *
 * @param text - Placeholder source shown until focus or input.
 * @param options - Highlighting and theme options.
 */
function buildSyntaxPlaceholderDecorations(
  text: string,
  options: SyntaxHighlightedPlaceholderOptions
): DecorationSet {
  return Decoration.set([
    Decoration.widget({
      widget: new SyntaxHighlightedPlaceholderWidget(text, options),
      side: 1
    }).range(0)
  ]);
}

/**
 * ViewPlugin that tracks editor engagement and renders placeholder decorations.
 */
class SyntaxHighlightedPlaceholderPlugin {
  placeholder: DecorationSet;

  /**
   * True after a pointer press inside the editor; cleared when focus leaves the editor
   * while the document is still empty.
   */
  engaged = false;

  /**
   * @param view - Parent CodeMirror editor view.
   * @param text - Placeholder source shown until the user engages or types.
   * @param options - Highlighting and theme options.
   */
  constructor(
    view: EditorView,
    private readonly text: string,
    private readonly options: SyntaxHighlightedPlaceholderOptions
  ) {
    this.placeholder = this.compute(view);
  }

  /**
   * Recomputes placeholder decorations from document length and engagement state.
   *
   * @param view - Parent CodeMirror editor view.
   */
  compute(view: EditorView): DecorationSet {
    return shouldShowSyntaxPlaceholder(view, this.engaged)
      ? buildSyntaxPlaceholderDecorations(this.text, this.options)
      : Decoration.none;
  }

  /**
   * Applies a new engagement flag and refreshes decorations when it changes.
   *
   * @param view - Parent CodeMirror editor view.
   * @param nextEngaged - Whether the user has pressed inside the editor chrome.
   */
  setEngaged(view: EditorView, nextEngaged: boolean): void {
    if (this.engaged === nextEngaged) {
      return;
    }
    this.engaged = nextEngaged;
    this.placeholder = this.compute(view);
    view.dispatch({});
  }

  /**
   * Shows or hides the placeholder when the document, focus, or engagement changes.
   *
   * @param update - Parent view update.
   */
  update(update: ViewUpdate): void {
    if (update.docChanged || update.focusChanged || update.view.state.doc.length === 0) {
      this.placeholder = this.compute(update.view);
    }
  }

  get decorations(): DecorationSet {
    return this.placeholder;
  }
}

/**
 * Returns whether a DOM event target lies inside the editor root element.
 *
 * @param view - Parent CodeMirror editor view.
 * @param target - Event target node.
 */
function isEventTargetInEditor(view: EditorView, target: EventTarget | null): boolean {
  return target instanceof Node && view.dom.contains(target);
}

/**
 * Returns CodeMirror extensions that show muted syntax-highlighted placeholder content
 * when the editor document is empty and unfocused.
 *
 * @param text - Placeholder source shown until the user focuses or types.
 * @param options - Highlighting and theme options shared with the parent editor.
 */
export function createSyntaxHighlightedPlaceholder(
  text: string,
  options: SyntaxHighlightedPlaceholderOptions
): Extension[] {
  const placeholderPlugin = ViewPlugin.fromClass(
    class extends SyntaxHighlightedPlaceholderPlugin {
      /**
       * Initializes placeholder decorations for an empty, unfocused document.
       *
       * @param view - Parent CodeMirror editor view.
       */
      constructor(view: EditorView) {
        super(view, text, options);
      }
    },
    { decorations: (v) => v.decorations }
  );

  /**
   * Marks the editor engaged on pointer presses inside the editor chrome only.
   *
   * @param view - Parent CodeMirror editor view.
   * @param event - Pointer or mouse event from the editor root.
   */
  const handleEditorPointerDown = (view: EditorView, event: Event): void => {
    if (view.state.doc.length > 0 || !isEventTargetInEditor(view, event.target)) {
      return;
    }

    const plugin = view.plugin(placeholderPlugin);
    if (plugin == null) {
      return;
    }

    plugin.setEngaged(view, true);
  };

  /**
   * Clears engagement after focus leaves the editor while the document is still empty.
   *
   * @param view - Parent CodeMirror editor view.
   */
  const handleEditorFocusOut = (view: EditorView): void => {
    requestAnimationFrame(() => {
      if (view.state.doc.length > 0 || isEditorDomFocused(view)) {
        return;
      }

      const plugin = view.plugin(placeholderPlugin);
      if (plugin == null) {
        return;
      }

      plugin.setEngaged(view, false);
    });
  };

  const engagementHandlers = EditorView.domEventHandlers({
    mousedown(event, view) {
      handleEditorPointerDown(view, event);
      return false;
    },
    pointerdown(event, view) {
      handleEditorPointerDown(view, event);
      return false;
    },
    focusout(_event, view) {
      handleEditorFocusOut(view);
      return false;
    }
  });

  return [
    placeholderPlugin,
    engagementHandlers,
    EditorView.contentAttributes.of({ 'aria-placeholder': text }),
    EditorView.theme({
      '.cm-content:has(.cm-syntax-placeholder) .cm-activeLine': {
        backgroundColor: 'transparent !important'
      }
    })
  ];
}
