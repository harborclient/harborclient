import { type CompletionSource, autocompletion, closeCompletion } from '@codemirror/autocomplete';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { forceLinting } from '@codemirror/lint';
import { Compartment, type Extension, Prec } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
  hoverTooltip,
  keymap
} from '@codemirror/view';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from '@harborclient/sdk/react';
import CodeMirrorImport from '@uiw/react-codemirror';
import type { ComponentPropsWithoutRef, JSX } from 'react';
import type { CodeEditorSetup, CodeEditorTheme, Variable } from '../../types.js';
import { isAppearanceDark } from '../../ui/appearanceTheme.js';
import { normalizeCodeEditorFontSize } from '../../ui/codeEditorSettings.js';
import { VARIABLE_NAME_CHARS, getVariableTooltipContent } from '../../variables/index.js';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { buildVariableTooltipDom } from '../VariableTooltip/dom.js';
import { VariableTooltipValue } from '../VariableTooltip/index.js';
import { portalToBody } from '../portalToBody.js';
import { useCodeEditorConfig } from './config.js';
import { createBuiltInSyntaxHighlighting, createEditorTheme } from './editorChrome.js';
import { type CodeEditorDiagnostic, createHostDiagnosticsLinter } from './hostDiagnostics.js';
import { createSlashCommandHighlighter } from './slashCommandHighlighter.js';
import { createSyntaxHighlightedPlaceholder } from './syntaxHighlightedPlaceholder.js';
import { createJavascriptSyntaxLinter, createJsonSyntaxLinter } from './syntaxLinters.js';
import { getCodeEditorThemeExtension } from './themes.js';

export { CODE_EDITOR_THEME_OPTIONS } from './themes.js';
export type { CodeEditorDiagnostic, CodeEditorDiagnosticAction } from './hostDiagnostics.js';

export type CodeEditorLanguage = 'json' | 'text' | 'javascript' | 'shell' | 'css';

/**
 * One slash command offered at the start of a line in the editor.
 */
export interface CodeEditorSlashCommand {
  /**
   * Command name without the leading slash (for example `ask`).
   */
  name: string;

  /**
   * Short description shown in autocomplete.
   */
  description?: string;
}

/**
 * Screen coordinates for anchoring host UI near a slash command.
 */
export interface CodeEditorSlashCoords {
  /**
   * Top edge in viewport pixels.
   */
  top: number;

  /**
   * Left edge in viewport pixels.
   */
  left: number;

  /**
   * Bottom edge in viewport pixels.
   */
  bottom: number;

  /**
   * Right edge in viewport pixels.
   */
  right: number;
}

/**
 * Parsed slash command at the caret line, passed to {@link Props.onSlashCommand}.
 */
export interface CodeEditorSlashTrigger {
  /**
   * Matched command name without the leading slash.
   */
  command: string;

  /**
   * Optional arguments typed after the command on the same line.
   */
  args: string;

  /**
   * 1-based line number where the command appears.
   */
  line: number;

  /**
   * Document offset of the leading slash character.
   */
  from: number;

  /**
   * Document offset after the matched command span (exclusive).
   */
  to: number;

  /**
   * Viewport coordinates near the command for positioning host UI.
   */
  coords: CodeEditorSlashCoords;
}

/**
 * Document offsets for a CodeMirror selection range.
 */
export interface CodeEditorSelectionRange {
  /**
   * Anchor offset in the document.
   */
  anchor: number;

  /**
   * Head (active caret) offset in the document.
   */
  head: number;
}

/**
 * Scroll and selection snapshot reported by {@link Props.onViewStateChange}.
 */
export interface CodeEditorViewState {
  /**
   * Vertical scroll offset of the CodeMirror scroller in pixels.
   */
  scrollTop: number;

  /**
   * Current selection range in document offsets.
   */
  selection: CodeEditorSelectionRange;
}

/**
 * Selected text range passed to {@link CodeEditorSelectionAction.onSelect}.
 */
export interface CodeEditorTextSelection {
  /**
   * Selected document text.
   */
  text: string;

  /**
   * Start offset (inclusive) in the document.
   */
  from: number;

  /**
   * End offset (exclusive) in the document.
   */
  to: number;
}

/**
 * One action offered in the floating toolbar when the user selects text.
 */
export interface CodeEditorSelectionAction {
  /**
   * Stable action id for host routing.
   */
  id: string;

  /**
   * Visible button label.
   */
  label: string;

  /**
   * Accessible name for the action button.
   */
  ariaLabel: string;

  /**
   * Called when the user activates this action on the current selection.
   */
  onSelect: (selection: CodeEditorTextSelection) => void;

  /**
   * Optional leading icon shown before the action label.
   */
  icon?: IconDefinition;

  /**
   * Optional shortcut hint shown after the label (for example `Ctrl+L`).
   */
  shortcutHint?: string;

  /**
   * Optional CodeMirror key binding that triggers this action on the current selection.
   */
  key?: string;
}

export interface Props extends Omit<
  ComponentPropsWithoutRef<'div'>,
  | 'children'
  | 'onChange'
  | 'className'
  | 'id'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-invalid'
  | 'aria-describedby'
  | 'style'
> {
  /**
   * Editor content.
   */
  value: string;

  /**
   * Called when the user edits the content; omitted for read-only views.
   */
  onChange?: (value: string) => void;

  /**
   * Syntax mode for highlighting.
   */
  language?: CodeEditorLanguage;

  /**
   * When true, the editor cannot be edited.
   */
  readOnly?: boolean;

  /**
   * When false, blocks user input while keeping normal editor chrome (gutters, border).
   * Defaults to the inverse of {@link readOnly}. Use for temporary locks during async work.
   */
  editable?: boolean;

  /**
   * Placeholder shown when the editor is empty.
   */
  placeholder?: string;

  /**
   * When true, renders the placeholder as muted syntax-highlighted ghost content (JavaScript only).
   */
  placeholderHighlight?: boolean;

  /**
   * Minimum editor height in CSS units.
   */
  minHeight?: string;

  /**
   * Explicit editor height in CSS units. When set, restores a user-resized height.
   */
  height?: string;

  /**
   * Called when the wrapper height changes (for example after native resize-y drag).
   */
  onHeightChange?: (heightPx: number) => void;

  /**
   * Restores vertical scroll when the editor is created.
   */
  initialScrollTop?: number;

  /**
   * Restores caret/selection when the editor is created.
   */
  initialSelection?: CodeEditorSelectionRange;

  /**
   * Called when scroll or selection changes, debounced, and once on unmount.
   */
  onViewStateChange?: (state: CodeEditorViewState) => void;

  /**
   * Additional wrapper classes.
   */
  className?: string;

  /**
   * Collection-scoped variables for {{token}} highlighting and tooltips.
   */
  variables?: Variable[];

  /**
   * Opens settings to edit a hovered variable.
   *
   * @param key - Variable name from the hovered {{key}} token.
   */
  onEditVariable?: (key: string) => void;

  /**
   * When set on a JavaScript editor, enables custom autocomplete (e.g. hc API completions).
   */
  completionSource?: CompletionSource;

  /**
   * Slash commands recognized at the start of a line (for example `/ask`).
   */
  slashCommands?: CodeEditorSlashCommand[];

  /**
   * Called when the user presses Enter on a complete slash command line.
   */
  onSlashCommand?: (trigger: CodeEditorSlashTrigger) => void;

  /**
   * Actions shown in a floating toolbar when the user selects non-empty text.
   */
  selectionActions?: CodeEditorSelectionAction[];

  /**
   * When true, shows inline syntax-error squiggles for supported languages.
   * Defaults to true.
   */
  lint?: boolean;

  /**
   * Host-supplied diagnostic markers (for example assertion failures).
   *
   * Independent of {@link lint} syntax checking; rendered as CodeMirror lint
   * underlines with hover tooltips.
   */
  diagnostics?: CodeEditorDiagnostic[];

  /**
   * When set, overrides the persisted CodeMirror theme (used by the settings preview).
   */
  themeOverride?: CodeEditorTheme;

  /**
   * When set, overrides persisted basicSetup options (used by the settings preview).
   */
  setupOverride?: CodeEditorSetup;

  /**
   * When set, overrides the persisted editor font size (used by the settings preview).
   */
  fontSize?: string;

  /**
   * DOM id applied to the editable region for label association.
   */
  id?: string;

  /**
   * Accessible name when no visible label is associated via `htmlFor`.
   */
  'aria-label'?: string;

  /**
   * Id of the element that labels this editor when using `aria-labelledby`.
   */
  'aria-labelledby'?: string;

  /**
   * When true, marks the editor as failing validation for assistive technologies.
   */
  'aria-invalid'?: boolean | 'true' | 'false';

  /**
   * Ids of elements describing the editor, merged with variable tooltip ids when active.
   */
  'aria-describedby'?: string;
}

/**
 * Clamps selection offsets to the current document length.
 *
 * @returns Offsets safe to dispatch into CodeMirror.
 */
function clampSelection(
  docLength: number,
  selection: CodeEditorSelectionRange
): CodeEditorSelectionRange {
  const maxOffset = Math.max(0, docLength);
  return {
    anchor: Math.min(Math.max(0, selection.anchor), maxOffset),
    head: Math.min(Math.max(0, selection.head), maxOffset)
  };
}

/** Debounce interval for {@link Props.onViewStateChange} notifications. */
const VIEW_STATE_DEBOUNCE_MS = 300;

/** Delay before showing the selection action toolbar after selection settles. */
const SELECTION_TOOLBAR_SHOW_DELAY_MS = 450;

/** Extra viewport gap between the selection top edge and the portaled toolbar. */
const SELECTION_TOOLBAR_OFFSET_PX = 16;

const variableMatcher = new MatchDecorator({
  regexp: new RegExp(`\\{\\{\\s*([${VARIABLE_NAME_CHARS}]+)\\s*\\}\\}`, 'g'),
  decoration: Decoration.mark({ class: 'cm-variable-token' })
});

const variableHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    /**
     * Builds the initial {{variable}} decoration set for the editor view.
     */
    constructor(view: EditorView) {
      this.decorations = variableMatcher.createDeco(view);
    }

    /**
     * Recomputes decorations when document content or viewport changes.
     */
    update(update: ViewUpdate): void {
      this.decorations = variableMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

/** Matches a slash command at the start of a line with optional arguments. */
const SLASH_COMMAND_LINE_PATTERN = /^(\s*)\/(\w+)(?:[ \t]+(.*))?$/;

/**
 * Returns a parsed slash command on a line when the name is registered.
 */
function parseSlashCommandLine(
  lineText: string,
  lineFrom: number,
  lineNumber: number,
  commands: CodeEditorSlashCommand[]
): Omit<CodeEditorSlashTrigger, 'coords'> | null {
  const match = lineText.match(SLASH_COMMAND_LINE_PATTERN);
  if (!match) {
    return null;
  }

  const command = match[2];
  if (command == null || !commands.some((entry) => entry.name === command)) {
    return null;
  }

  const leading = match[1] ?? '';
  const slashIndex = leading.length;
  const from = lineFrom + slashIndex;
  const to = lineFrom + lineText.length;

  return {
    command,
    args: (match[3] ?? '').trim(),
    line: lineNumber,
    from,
    to
  };
}

/**
 * Builds a CodeMirror completion source for registered slash commands at line start.
 */
function createSlashCommandCompletionSource(commands: CodeEditorSlashCommand[]): CompletionSource {
  /**
   * Returns slash command completions when the caret follows `/` at line start.
   */
  return (context) => {
    const word = context.matchBefore(/^\s*\/\w*/);
    if (!word || word.text.length === 0) {
      return null;
    }

    const partial = word.text.replace(/^\s*\//, '');
    const options = commands
      .filter((entry) => entry.name.startsWith(partial))
      .map((entry) => ({
        label: `/${entry.name}`,
        type: 'keyword' as const,
        detail: entry.description,
        apply: `/${entry.name} `
      }));

    if (options.length === 0) {
      return null;
    }

    return { from: word.from, options };
  };
}

/**
 * Combines slash-command and host completion sources so the slash regex is
 * skipped on non-slash lines (the common case in script bodies).
 *
 * @param slash - Prebuilt slash completion source for the registered commands.
 * @param host - Host-provided completion source (e.g. `hc` API completions).
 * @returns A single completion source that branches on the current line prefix.
 */
function createScriptCompletionSource(
  slash: CompletionSource,
  host: CompletionSource
): CompletionSource {
  /**
   * Routes to slash completions when the line starts with optional whitespace
   * and `/`; otherwise delegates to the host source without running slash logic.
   */
  return (context) => {
    const line = context.state.doc.lineAt(context.pos);
    const lineText = line.text.slice(0, context.pos - line.from);
    if (/^\s*\//.test(lineText)) {
      return slash(context);
    }
    return host(context);
  };
}

/**
 * Returns an Enter keymap that triggers registered slash commands before default newline handling.
 */
function slashCommandEnterHandler(
  commands: CodeEditorSlashCommand[],
  onSlashCommand: (trigger: CodeEditorSlashTrigger) => void
): ReturnType<typeof Prec.highest> {
  return Prec.highest(
    keymap.of([
      {
        key: 'Enter',
        /**
         * Opens host slash-command UI when Enter is pressed on a complete command line.
         */
        run: (view): boolean => {
          const pos = view.state.selection.main.head;
          const line = view.state.doc.lineAt(pos);
          const parsed = parseSlashCommandLine(line.text, line.from, line.number, commands);
          if (!parsed) {
            return false;
          }

          const coords = view.coordsAtPos(parsed.from);
          if (!coords) {
            return false;
          }

          // Dismiss the autocomplete popup so its Enter binding does not also fire.
          closeCompletion(view);

          onSlashCommand({
            ...parsed,
            coords: {
              top: coords.top,
              left: coords.left,
              bottom: coords.bottom,
              right: coords.right
            }
          });
          return true;
        }
      }
    ])
  );
}

interface SelectionTooltipState {
  key: string;
  top: number;
  left: number;
}

interface SelectionActionToolbarState {
  top: number;
  left: number;
  text: string;
  from: number;
  to: number;
}

/**
 * Finds the {{variable}} token at a document position, if any.
 *
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
    if (pos < start || pos > end) continue;
    return { key: match[1], start, end };
  }

  return null;
}

/**
 * Joins non-empty element ids into a space-separated `aria-describedby` value.
 *
 * @returns Merged id string, or undefined when no ids are provided.
 */
function mergeDescribedBy(...ids: (string | undefined)[]): string | undefined {
  const merged = ids.filter((id): id is string => id != null && id !== '');
  return merged.length > 0 ? merged.join(' ') : undefined;
}

/**
 * Sets or clears `aria-describedby` on the CodeMirror content element.
 */
function setContentDescribedBy(
  content: Element | null | undefined,
  getValidationDescribedBy: () => string | undefined,
  tooltipId?: string
): void {
  if (!content) return;
  const describedBy = mergeDescribedBy(getValidationDescribedBy(), tooltipId);
  if (describedBy) {
    content.setAttribute('aria-describedby', describedBy);
  } else {
    content.removeAttribute('aria-describedby');
  }
}

/**
 * Shows a keyboard-driven tooltip when the caret moves inside a {{variable}} token.
 */
function variableSelectionTooltip(
  tooltipId: string,
  onTooltipChange: (state: SelectionTooltipState | null) => void,
  getValidationDescribedBy: () => string | undefined
): ReturnType<typeof EditorView.updateListener.of> {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet && !update.docChanged) return;

    const content = update.view.dom.querySelector('.cm-content');
    const pos = update.state.selection.main.head;
    const match = findVariableAtPos(update.state.doc, pos);

    if (!match) {
      onTooltipChange(null);
      setContentDescribedBy(content, getValidationDescribedBy);
      return;
    }

    const coords = update.view.coordsAtPos(match.start);
    if (!coords) {
      onTooltipChange(null);
      setContentDescribedBy(content, getValidationDescribedBy);
      return;
    }

    onTooltipChange({
      key: match.key,
      top: coords.top,
      left: coords.left + (coords.right - coords.left) / 2
    });
    setContentDescribedBy(content, getValidationDescribedBy, tooltipId);
  });
}

/**
 * Dismisses the keyboard tooltip when Escape is pressed.
 */
function variableTooltipEscapeHandler(
  isOpen: () => boolean,
  onDismiss: () => void,
  getValidationDescribedBy: () => string | undefined
): ReturnType<typeof EditorView.domEventHandlers> {
  return EditorView.domEventHandlers({
    keydown(event, view) {
      if (event.key === 'Escape' && isOpen()) {
        event.preventDefault();
        onDismiss();
        setContentDescribedBy(view.dom.querySelector('.cm-content'), getValidationDescribedBy);
        return true;
      }
      return false;
    }
  });
}

/**
 * Computes viewport anchor coordinates for the selection action toolbar.
 *
 * @param view - CodeMirror editor view.
 * @param selectionFrom - Start offset (inclusive) of the selection.
 * @param selectionTo - End offset (exclusive) of the selection.
 * @returns Toolbar anchor position, or null when coords are unavailable.
 */
function computeSelectionActionToolbarCoords(
  view: EditorView,
  selectionFrom: number,
  selectionTo: number
): { top: number; left: number } | null {
  const startCoords = view.coordsAtPos(selectionFrom);
  if (!startCoords) {
    return null;
  }

  const endCoords = view.coordsAtPos(selectionTo);
  const startCenter = startCoords.left + (startCoords.right - startCoords.left) / 2;
  const endCenter = endCoords
    ? endCoords.left + (endCoords.right - endCoords.left) / 2
    : startCenter;

  return {
    top: startCoords.top,
    left: (startCenter + endCenter) / 2
  };
}

/**
 * Shared debounce and pointer-drag state for the selection action toolbar.
 */
interface SelectionActionToolbarController {
  showTimer: ReturnType<typeof setTimeout> | undefined;
  isPointerSelecting: boolean;
  isToolbarOpen: boolean;
  pendingState: SelectionActionToolbarState | null;
}

/**
 * Builds update and pointer handlers that debounce toolbar display until selection settles.
 */
function createSelectionActionToolbarExtensions(
  onToolbarChange: (state: SelectionActionToolbarState | null) => void,
  isEnabled: () => boolean,
  isOpen: () => boolean,
  onDismiss: () => void
): Extension[] {
  const controller: SelectionActionToolbarController = {
    showTimer: undefined,
    isPointerSelecting: false,
    isToolbarOpen: false,
    pendingState: null
  };

  /**
   * Clears a scheduled toolbar reveal without changing open state.
   */
  const clearShowTimer = (): void => {
    if (controller.showTimer) {
      clearTimeout(controller.showTimer);
      controller.showTimer = undefined;
    }
  };

  /**
   * Notifies React of toolbar visibility while keeping controller state in sync.
   */
  const notifyToolbarChange = (state: SelectionActionToolbarState | null): void => {
    controller.isToolbarOpen = state != null;
    if (state == null) {
      controller.pendingState = null;
    }
    onToolbarChange(state);
  };

  /**
   * Hides the toolbar immediately and cancels any pending reveal.
   */
  const dismissToolbar = (): void => {
    clearShowTimer();
    if (controller.isToolbarOpen || controller.pendingState != null) {
      notifyToolbarChange(null);
    }
  };

  /**
   * Schedules toolbar display after the configured settle delay.
   */
  const scheduleShow = (state: SelectionActionToolbarState): void => {
    controller.pendingState = state;
    clearShowTimer();

    if (controller.isPointerSelecting) {
      return;
    }

    controller.showTimer = setTimeout(() => {
      controller.showTimer = undefined;
      if (controller.isPointerSelecting) {
        return;
      }
      notifyToolbarChange(state);
    }, SELECTION_TOOLBAR_SHOW_DELAY_MS);
  };

  /**
   * Repositions or reveals the toolbar without waiting when it is already open.
   */
  const showImmediately = (state: SelectionActionToolbarState): void => {
    clearShowTimer();
    notifyToolbarChange(state);
  };

  const updateListener = EditorView.updateListener.of((update) => {
    if (!isEnabled()) {
      dismissToolbar();
      return;
    }

    if (!update.selectionSet && !update.docChanged && !update.viewportChanged) {
      return;
    }

    const { from, to } = update.state.selection.main;
    if (from === to) {
      dismissToolbar();
      return;
    }

    const selectionFrom = Math.min(from, to);
    const selectionTo = Math.max(from, to);
    const text = update.state.sliceDoc(selectionFrom, selectionTo);
    if (!text.trim()) {
      dismissToolbar();
      return;
    }

    const coords = computeSelectionActionToolbarCoords(update.view, selectionFrom, selectionTo);
    if (!coords) {
      dismissToolbar();
      return;
    }

    const nextState: SelectionActionToolbarState = {
      top: coords.top,
      left: coords.left,
      text,
      from: selectionFrom,
      to: selectionTo
    };

    if (isOpen() && !update.selectionSet && update.viewportChanged) {
      showImmediately(nextState);
      return;
    }

    if (isOpen() && update.selectionSet) {
      scheduleShow(nextState);
      return;
    }

    scheduleShow(nextState);
  });

  const pointerGuard = EditorView.domEventHandlers({
    /**
     * Suppresses toolbar reveal while the user is drag-selecting with the primary button.
     */
    pointerdown(event) {
      if (event.button === 0) {
        controller.isPointerSelecting = true;
        clearShowTimer();
      }
      return false;
    },
    /**
     * Resumes debounced reveal after drag-select completes.
     */
    pointerup() {
      controller.isPointerSelecting = false;
      if (controller.pendingState != null && !isOpen()) {
        scheduleShow(controller.pendingState);
      }
      return false;
    }
  });

  const dismissHandler = EditorView.domEventHandlers({
    keydown(event) {
      if (event.key === 'Escape' && isOpen()) {
        event.preventDefault();
        dismissToolbar();
        onDismiss();
        return true;
      }
      return false;
    }
  });

  const cleanupPlugin = ViewPlugin.fromClass(
    class {
      /**
       * Clears any pending toolbar reveal when the editor extension is destroyed.
       */
      destroy(): void {
        clearShowTimer();
      }
    }
  );

  return [updateListener, pointerGuard, dismissHandler, cleanupPlugin];
}

/**
 * Registers keyboard shortcuts for selection toolbar actions.
 *
 * @param actions - Selection actions that define a {@link CodeEditorSelectionAction.key}.
 * @param onToolbarChange - Clears the floating toolbar after a shortcut fires.
 */
function createSelectionActionKeymap(
  actions: CodeEditorSelectionAction[],
  onToolbarChange: (state: SelectionActionToolbarState | null) => void
): Extension | null {
  const keyedActions = actions.filter((action) => action.key);
  if (keyedActions.length === 0) {
    return null;
  }

  return Prec.highest(
    keymap.of(
      keyedActions.map((action) => ({
        key: action.key!,
        run(view) {
          const { from, to } = view.state.selection.main;
          if (from === to) {
            return false;
          }

          const selectionFrom = Math.min(from, to);
          const selectionTo = Math.max(from, to);
          const text = view.state.sliceDoc(selectionFrom, selectionTo);
          if (!text.trim()) {
            return false;
          }

          action.onSelect({
            text,
            from: selectionFrom,
            to: selectionTo
          });
          onToolbarChange(null);
          return true;
        }
      }))
    )
  );
}

/**
 * Builds a hover tooltip extension for {{variable}} tokens.
 */
function variableTooltip(
  getVariables: () => Variable[],
  getOnEditVariable: () => ((key: string) => void) | undefined
): ReturnType<typeof hoverTooltip> {
  return hoverTooltip((view, pos) => {
    const match = findVariableAtPos(view.state.doc, pos);
    if (!match) return null;

    return {
      pos: match.start,
      end: match.end,
      above: true,
      create() {
        return {
          dom: buildVariableTooltipDom(match.key, getVariables(), getOnEditVariable())
        };
      }
    };
  });
}

/** Size of the native resize-y grip hit target in the bottom-right corner. */
const RESIZE_GRIP_PX = 16;

/** CodeMirror compartments for partial extension reconfiguration without full editor reset. */
interface CodeEditorCompartments {
  core: Compartment;
  completion: Compartment;
  a11y: Compartment;
  placeholder: Compartment;
  diagnostics: Compartment;
}

/**
 * Builds theme, language, lint, view-state, and variable tooling extensions.
 *
 * @returns Extensions that change with language, theme, lint, or variable presence.
 */
function buildCoreExtensions(options: {
  editorThemeExt: Extension;
  trackViewState: boolean;
  viewStateSelectionListener: Extension;
  resolvedTheme: CodeEditorTheme;
  isDark: boolean;
  language: CodeEditorLanguage;
  lint: boolean;
  hasVariables: boolean;
  tooltipId: string;
  getVariables: () => Variable[];
  getOnEditVariable: () => ((key: string) => void) | undefined;
  getValidationDescribedBy: () => string | undefined;
  onSelectionTooltipChange: (state: SelectionTooltipState | null) => void;
  isSelectionTooltipOpen: () => boolean;
  onDismissSelectionTooltip: () => void;
  hasSelectionActions: boolean;
  selectionActions: CodeEditorSelectionAction[];
  onSelectionActionToolbarChange: (state: SelectionActionToolbarState | null) => void;
  isSelectionActionToolbarOpen: () => boolean;
  onDismissSelectionActionToolbar: () => void;
}): Extension[] {
  const next: Extension[] = [options.editorThemeExt];
  if (options.trackViewState) {
    next.push(options.viewStateSelectionListener);
  }
  const themeExtension = getCodeEditorThemeExtension(options.resolvedTheme);
  if (themeExtension) {
    next.push(themeExtension);
  } else {
    next.push(createBuiltInSyntaxHighlighting(options.isDark));
  }
  if (options.language === 'json') {
    next.push(json());
  }
  if (options.language === 'javascript') {
    next.push(javascript());
  }
  if (options.language === 'shell') {
    next.push(StreamLanguage.define(shell));
  }
  if (options.language === 'css') {
    next.push(css());
  }
  if (options.lint) {
    if (options.language === 'json') {
      next.push(createJsonSyntaxLinter());
    }
    if (options.language === 'javascript') {
      next.push(createJavascriptSyntaxLinter());
    }
  }
  if (options.hasVariables) {
    next.push(
      variableHighlighter,
      variableTooltip(options.getVariables, options.getOnEditVariable),
      variableSelectionTooltip(
        options.tooltipId,
        options.onSelectionTooltipChange,
        options.getValidationDescribedBy
      ),
      variableTooltipEscapeHandler(
        options.isSelectionTooltipOpen,
        options.onDismissSelectionTooltip,
        options.getValidationDescribedBy
      )
    );
  }
  if (options.hasSelectionActions) {
    next.push(
      ...createSelectionActionToolbarExtensions(
        options.onSelectionActionToolbarChange,
        () => options.hasSelectionActions,
        options.isSelectionActionToolbarOpen,
        options.onDismissSelectionActionToolbar
      )
    );
    const keymapExtension = createSelectionActionKeymap(
      options.selectionActions,
      options.onSelectionActionToolbarChange
    );
    if (keymapExtension) {
      next.push(keymapExtension);
    }
  }
  return next;
}

/**
 * Builds JavaScript slash-command and autocompletion extensions.
 *
 * @returns Extensions that change with slash commands or a host completion source.
 */
function buildCompletionExtensions(options: {
  language: CodeEditorLanguage;
  slashCommands: CodeEditorSlashCommand[] | undefined;
  hasCompletionSource: boolean;
  stableCompletionSource: CompletionSource;
  slashCompletionSource: CompletionSource | null;
  onSlashCommand: (trigger: CodeEditorSlashTrigger) => void;
}): Extension[] {
  if (options.language !== 'javascript') {
    return [];
  }

  const next: Extension[] = [];
  const slashCommands = options.slashCommands;
  const hasSlashCommands = slashCommands != null && slashCommands.length > 0;

  // Register the slash Enter handler before autocompletion so that, at equal
  // Prec.highest precedence, this handler wins the tie and fires before the
  // completion keymap's Enter->accept binding.
  if (hasSlashCommands) {
    next.push(slashCommandEnterHandler(slashCommands, options.onSlashCommand));
  }

  const completionOverrides: CompletionSource[] = [];
  if (hasSlashCommands && options.hasCompletionSource && options.slashCompletionSource) {
    completionOverrides.push(
      createScriptCompletionSource(options.slashCompletionSource, options.stableCompletionSource)
    );
  } else if (hasSlashCommands && options.slashCompletionSource) {
    completionOverrides.push(options.slashCompletionSource);
  } else if (options.hasCompletionSource) {
    completionOverrides.push(options.stableCompletionSource);
  }
  if (completionOverrides.length > 0) {
    next.push(
      autocompletion({
        activateOnTyping: true,
        activateOnTypingDelay: 75,
        maxRenderedOptions: 20,
        override: completionOverrides
      })
    );
  }
  if (hasSlashCommands) {
    next.push(createSlashCommandHighlighter(slashCommands));
  }
  return next;
}

/**
 * Builds accessibility content attributes for the editable region.
 *
 * @returns Extensions that change with aria props or the editor id.
 */
function buildA11yExtensions(options: {
  id: string | undefined;
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
  ariaInvalid: boolean | 'true' | 'false' | undefined;
  ariaDescribedBy: string | undefined;
}): Extension[] {
  const contentAttrs: Record<string, string> = {};
  if (options.id) contentAttrs.id = options.id;
  if (options.ariaLabel) contentAttrs['aria-label'] = options.ariaLabel;
  if (options.ariaLabelledBy) contentAttrs['aria-labelledby'] = options.ariaLabelledBy;
  if (options.ariaInvalid != null) contentAttrs['aria-invalid'] = String(options.ariaInvalid);
  if (options.ariaDescribedBy) contentAttrs['aria-describedby'] = options.ariaDescribedBy;
  if (Object.keys(contentAttrs).length === 0) {
    return [];
  }
  return [EditorView.contentAttributes.of(contentAttrs)];
}

/**
 * Builds muted syntax-highlighted placeholder ghost layers for empty JavaScript editors.
 *
 * @returns Extensions that change with placeholder text, theme, or slash commands.
 */
function buildPlaceholderExtensions(options: {
  useHighlightedPlaceholder: boolean;
  placeholder: string | undefined;
  resolvedFontSize: string;
  isDark: boolean;
  resolvedTheme: CodeEditorTheme;
  slashCommands: CodeEditorSlashCommand[] | undefined;
}): Extension[] {
  if (!options.useHighlightedPlaceholder || !options.placeholder) {
    return [];
  }
  return createSyntaxHighlightedPlaceholder(options.placeholder, {
    fontSize: options.resolvedFontSize,
    isDark: options.isDark,
    theme: options.resolvedTheme,
    slashCommands: options.slashCommands
  });
}

/**
 * CodeMirror wrapper for editable request bodies and read-only response views.
 *
 * Styling relies on host CSS variables (`--mac-*`, `--font-mono`) and the `.app-no-drag`
 * class defined in HarborClient `styles.css`.
 */
export function CodeEditor({
  value,
  onChange,
  language = 'text',
  readOnly = false,
  editable,
  placeholder,
  placeholderHighlight = false,
  minHeight = '144px',
  height,
  onHeightChange,
  initialScrollTop,
  initialSelection,
  onViewStateChange,
  className = '',
  variables,
  onEditVariable,
  completionSource,
  slashCommands,
  onSlashCommand,
  selectionActions,
  lint = true,
  diagnostics,
  themeOverride,
  setupOverride,
  fontSize,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  ...props
}: Props): JSX.Element {
  const config = useCodeEditorConfig();
  const resolvedTheme = themeOverride ?? config.theme;
  const resolvedSetup = setupOverride ?? (readOnly ? null : config.setup);
  const resolvedFontSize = normalizeCodeEditorFontSize(fontSize ?? config.fontSize);
  const resolvedEditable = editable ?? !readOnly;
  const [isDark, setIsDark] = useState(() => isAppearanceDark());
  const [selectionTooltip, setSelectionTooltip] = useState<SelectionTooltipState | null>(null);
  const selectionTooltipRef = useRef(selectionTooltip);
  selectionTooltipRef.current = selectionTooltip;
  const setSelectionTooltipRef = useRef(setSelectionTooltip);
  setSelectionTooltipRef.current = setSelectionTooltip;
  const [selectionActionToolbar, setSelectionActionToolbar] =
    useState<SelectionActionToolbarState | null>(null);
  const selectionActionToolbarRef = useRef(selectionActionToolbar);
  selectionActionToolbarRef.current = selectionActionToolbar;
  const setSelectionActionToolbarRef = useRef(setSelectionActionToolbar);
  setSelectionActionToolbarRef.current = setSelectionActionToolbar;
  const selectionToolbarElementRef = useRef<HTMLDivElement | null>(null);
  const selectionActionsRef = useRef(selectionActions);
  selectionActionsRef.current = selectionActions;
  const hasSelectionActions = selectionActions != null && selectionActions.length > 0;
  const ariaDescribedByRef = useRef(ariaDescribedBy);
  ariaDescribedByRef.current = ariaDescribedBy;
  const onSlashCommandRef = useRef(onSlashCommand);
  onSlashCommandRef.current = onSlashCommand;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const completionSourceRef = useRef(completionSource);
  completionSourceRef.current = completionSource;
  const variablesRef = useRef(variables);
  variablesRef.current = variables;
  const onEditVariableRef = useRef(onEditVariable);
  onEditVariableRef.current = onEditVariable;
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;
  const hasVariables = variables != null;
  const hasCompletionSource = completionSource != null;
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;
  const isUserResizingRef = useRef(false);
  const editorViewRef = useRef<EditorView | null>(null);
  const onViewStateChangeRef = useRef(onViewStateChange);
  onViewStateChangeRef.current = onViewStateChange;
  const initialScrollTopRef = useRef(initialScrollTop);
  initialScrollTopRef.current = initialScrollTop;
  const initialSelectionRef = useRef(initialSelection);
  initialSelectionRef.current = initialSelection;
  const viewStateDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollListenerCleanupRef = useRef<(() => void) | null>(null);
  const scheduleViewStateFlushRef = useRef<() => void>(() => undefined);
  const getValidationDescribedBy = (): string | undefined => ariaDescribedByRef.current;
  const compartmentsRef = useRef<CodeEditorCompartments | null>(null);
  if (!compartmentsRef.current) {
    compartmentsRef.current = {
      core: new Compartment(),
      completion: new Compartment(),
      a11y: new Compartment(),
      placeholder: new Compartment(),
      diagnostics: new Compartment()
    };
  }
  const {
    core: coreCompartment,
    completion: completionCompartment,
    a11y: a11yCompartment,
    placeholder: placeholderCompartment,
    diagnostics: diagnosticsCompartment
  } = compartmentsRef.current;

  /**
   * Reads the current scroll and selection snapshot from an editor view.
   *
   * @returns Rounded scroll offset and selection offsets.
   */
  const readViewState = useCallback((view: EditorView): CodeEditorViewState => {
    const selection = view.state.selection.main;
    return {
      scrollTop: Math.max(0, Math.round(view.scrollDOM.scrollTop)),
      selection: { anchor: selection.anchor, head: selection.head }
    };
  }, []);

  /**
   * Notifies the host of the latest scroll/selection snapshot.
   */
  const flushViewState = useCallback((): void => {
    const view = editorViewRef.current;
    if (!view || !onViewStateChangeRef.current) {
      return;
    }
    onViewStateChangeRef.current(readViewState(view));
  }, [readViewState]);

  /**
   * Debounces view-state persistence while the user scrolls or changes selection.
   */
  useEffect(() => {
    scheduleViewStateFlushRef.current = (): void => {
      if (viewStateDebounceRef.current) {
        clearTimeout(viewStateDebounceRef.current);
      }
      viewStateDebounceRef.current = setTimeout(() => {
        flushViewState();
      }, VIEW_STATE_DEBOUNCE_MS);
    };
  }, [flushViewState]);

  /**
   * Flushes scroll/selection on unmount so collapsed script rows retain view state.
   */
  useEffect(() => {
    return () => {
      if (viewStateDebounceRef.current) {
        clearTimeout(viewStateDebounceRef.current);
      }
      scrollListenerCleanupRef.current?.();
      scrollListenerCleanupRef.current = null;
      flushViewState();
      editorViewRef.current = null;
    };
  }, [flushViewState]);

  /**
   * Dismisses the portaled selection toolbar when the user clicks outside the editor and toolbar.
   */
  useEffect(() => {
    if (!selectionActionToolbar) {
      return;
    }

    /**
     * Closes the toolbar on outside pointer interaction without racing editor blur during selection.
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const editorRoot = editorViewRef.current?.dom;
      const toolbar = selectionToolbarElementRef.current;
      if (editorRoot?.contains(target) || toolbar?.contains(target)) {
        return;
      }

      setSelectionActionToolbar(null);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [selectionActionToolbar]);

  /**
   * Persists wrapper height only after the user finishes a native resize-y drag on the grip.
   * Ignores mount and layout settling so height props do not reconfigure CodeMirror in a loop.
   */
  useEffect(() => {
    if (!onHeightChange) {
      return;
    }

    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    /**
     * Marks resize drags that begin on the native bottom-right grip.
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const rect = wrapper.getBoundingClientRect();
      const onGrip =
        event.clientX >= rect.right - RESIZE_GRIP_PX &&
        event.clientY >= rect.bottom - RESIZE_GRIP_PX;
      if (onGrip) {
        isUserResizingRef.current = true;
      }
    };

    /**
     * Reports the final wrapper height after a completed user resize drag.
     */
    const handlePointerUp = (): void => {
      if (!isUserResizingRef.current) {
        return;
      }
      isUserResizingRef.current = false;
      const nextHeight = Math.round(wrapper.getBoundingClientRect().height);
      onHeightChangeRef.current?.(nextHeight);
    };

    wrapper.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      wrapper.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onHeightChange]);

  /**
   * Whether to render a muted syntax-highlighted ghost layer instead of plain placeholder text.
   */
  const useHighlightedPlaceholder = Boolean(
    placeholderHighlight && placeholder && language === 'javascript'
  );

  /**
   * Stable onChange wrapper so @uiw/react-codemirror does not reconfigure on every parent render.
   */
  const stableOnChange = useCallback((nextValue: string): void => {
    onChangeRef.current?.(nextValue);
  }, []);

  /**
   * Stable completion delegator reading the latest host source from a ref.
   */
  const stableCompletionSource = useMemo<CompletionSource>(
    () => (context) => completionSourceRef.current?.(context) ?? null,
    []
  );

  /**
   * Stable variable accessors for tooltip extensions.
   */
  const getVariables = useCallback((): Variable[] => variablesRef.current ?? [], []);
  const getOnEditVariable = useCallback(
    (): ((key: string) => void) | undefined => onEditVariableRef.current,
    []
  );

  /**
   * Memoized editor chrome theme keyed by font size only.
   */
  const editorThemeExt = useMemo(() => createEditorTheme(resolvedFontSize), [resolvedFontSize]);

  /**
   * Tracks the resolved app appearance so syntax highlighting and placeholder
   * rendering match the active theme. Listens for host theme applications
   * (`harborclient:theme-colors-applied`), OS color-scheme changes (System
   * appearance), and `data-theme` attribute swaps on the document root, and
   * cleans up all listeners on unmount.
   */
  useEffect(() => {
    const syncAppearance = (): void => setIsDark(isAppearanceDark());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', syncAppearance);
    window.addEventListener('harborclient:theme-colors-applied', syncAppearance);
    const observer = new MutationObserver(syncAppearance);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    syncAppearance();
    return () => {
      media.removeEventListener('change', syncAppearance);
      window.removeEventListener('harborclient:theme-colors-applied', syncAppearance);
      observer.disconnect();
    };
  }, []);

  /**
   * Stable selection listener that debounces view-state persistence.
   */
  const viewStateSelectionListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (!onViewStateChangeRef.current || !update.selectionSet) {
          return;
        }
        scheduleViewStateFlushRef.current();
      }),
    []
  );

  /**
   * Memoized slash completion source so completion bucket rebuilds stay cheap.
   */
  const slashCompletionSource = useMemo(
    () =>
      slashCommands != null && slashCommands.length > 0
        ? createSlashCommandCompletionSource(slashCommands)
        : null,
    [slashCommands]
  );

  /**
   * Stable slash-command callback reading the latest host handler from a ref.
   */
  const stableOnSlashCommand = useCallback((trigger: CodeEditorSlashTrigger): void => {
    onSlashCommandRef.current?.(trigger);
  }, []);

  /**
   * Theme, language, lint, view-state, and variable tooling extensions.
   */
  const coreExtensions = useMemo(
    () =>
      buildCoreExtensions({
        editorThemeExt,
        trackViewState: onViewStateChange != null,
        viewStateSelectionListener,
        resolvedTheme,
        isDark,
        language,
        lint,
        hasVariables,
        tooltipId,
        getVariables,
        getOnEditVariable,
        getValidationDescribedBy,
        onSelectionTooltipChange: (state) => {
          setSelectionTooltipRef.current(state);
        },
        isSelectionTooltipOpen: () => selectionTooltipRef.current != null,
        onDismissSelectionTooltip: () => {
          setSelectionTooltipRef.current(null);
        },
        hasSelectionActions,
        selectionActions: selectionActions ?? [],
        onSelectionActionToolbarChange: (state) => {
          setSelectionActionToolbarRef.current(state);
        },
        isSelectionActionToolbarOpen: () => selectionActionToolbarRef.current != null,
        onDismissSelectionActionToolbar: () => {
          setSelectionActionToolbarRef.current(null);
        }
      }),
    [
      editorThemeExt,
      onViewStateChange,
      viewStateSelectionListener,
      resolvedTheme,
      isDark,
      language,
      lint,
      hasVariables,
      hasSelectionActions,
      selectionActions,
      tooltipId,
      getVariables,
      getOnEditVariable
    ]
  );

  /**
   * Slash-command and autocompletion extensions for JavaScript editors.
   */
  const completionExtensions = useMemo(
    () =>
      buildCompletionExtensions({
        language,
        slashCommands,
        hasCompletionSource,
        stableCompletionSource,
        slashCompletionSource,
        onSlashCommand: stableOnSlashCommand
      }),
    [
      language,
      slashCommands,
      hasCompletionSource,
      stableCompletionSource,
      slashCompletionSource,
      stableOnSlashCommand
    ]
  );

  /**
   * Accessibility attributes on the editable content element.
   */
  const a11yExtensions = useMemo(
    () =>
      buildA11yExtensions({
        id,
        ariaLabel,
        ariaLabelledBy,
        ariaInvalid,
        ariaDescribedBy
      }),
    [id, ariaLabel, ariaLabelledBy, ariaInvalid, ariaDescribedBy]
  );

  /**
   * Syntax-highlighted placeholder ghost layers for empty JavaScript editors.
   */
  const placeholderExtensions = useMemo(
    () =>
      buildPlaceholderExtensions({
        useHighlightedPlaceholder,
        placeholder,
        resolvedFontSize,
        isDark,
        resolvedTheme,
        slashCommands
      }),
    [useHighlightedPlaceholder, placeholder, resolvedFontSize, isDark, resolvedTheme, slashCommands]
  );

  /**
   * Stable signature of host diagnostics so a new array identity each render
   * does not thrash compartment reconfigure.
   */
  const diagnosticsSignature = useMemo(() => JSON.stringify(diagnostics ?? []), [diagnostics]);

  /**
   * Host-supplied diagnostic lint markers (assertion failures, etc.).
   */
  const diagnosticsExtensions = useMemo(() => {
    if (diagnosticsSignature === '[]') {
      return [];
    }
    return [createHostDiagnosticsLinter(() => diagnosticsRef.current ?? [])];
  }, [diagnosticsSignature]);

  const coreExtensionsRef = useRef(coreExtensions);
  coreExtensionsRef.current = coreExtensions;
  const completionExtensionsRef = useRef(completionExtensions);
  completionExtensionsRef.current = completionExtensions;
  const a11yExtensionsRef = useRef(a11yExtensions);
  a11yExtensionsRef.current = a11yExtensions;
  const placeholderExtensionsRef = useRef(placeholderExtensions);
  placeholderExtensionsRef.current = placeholderExtensions;
  const diagnosticsExtensionsRef = useRef(diagnosticsExtensions);
  diagnosticsExtensionsRef.current = diagnosticsExtensions;

  /**
   * Restores persisted scroll/selection, syncs compartment extensions, and wires scroll tracking.
   */
  const stableOnCreateEditor = useCallback(
    (view: EditorView): void => {
      editorViewRef.current = view;

      view.dispatch({
        effects: [
          coreCompartment.reconfigure(coreExtensionsRef.current),
          completionCompartment.reconfigure(completionExtensionsRef.current),
          a11yCompartment.reconfigure(a11yExtensionsRef.current),
          placeholderCompartment.reconfigure(placeholderExtensionsRef.current),
          diagnosticsCompartment.reconfigure(diagnosticsExtensionsRef.current)
        ]
      });
      if (diagnosticsExtensionsRef.current.length > 0) {
        forceLinting(view);
      }

      const trackViewState =
        onViewStateChangeRef.current != null ||
        initialScrollTopRef.current != null ||
        initialSelectionRef.current != null;
      if (!trackViewState) {
        return;
      }

      const restoredSelection = initialSelectionRef.current;
      if (restoredSelection) {
        const clamped = clampSelection(view.state.doc.length, restoredSelection);
        view.dispatch({
          selection: { anchor: clamped.anchor, head: clamped.head }
        });
      }

      const restoredScrollTop = initialScrollTopRef.current;
      if (
        restoredScrollTop != null &&
        Number.isFinite(restoredScrollTop) &&
        restoredScrollTop >= 0
      ) {
        view.scrollDOM.scrollTop = restoredScrollTop;
      }

      /**
       * Schedules persistence when the user scrolls the editor content.
       */
      const handleScroll = (): void => {
        scheduleViewStateFlushRef.current();
      };

      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });
      scrollListenerCleanupRef.current = (): void => {
        view.scrollDOM.removeEventListener('scroll', handleScroll);
      };
    },
    [
      a11yCompartment,
      completionCompartment,
      coreCompartment,
      diagnosticsCompartment,
      placeholderCompartment
    ]
  );

  /**
   * Stable top-level extensions array; bucket contents update via compartment reconfigure.
   */
  const stableExtensionsRef = useRef<Extension[] | null>(null);
  if (!stableExtensionsRef.current) {
    stableExtensionsRef.current = [
      EditorView.lineWrapping,
      coreCompartment.of(coreExtensions),
      completionCompartment.of(completionExtensions),
      a11yCompartment.of(a11yExtensions),
      placeholderCompartment.of(placeholderExtensions),
      diagnosticsCompartment.of(diagnosticsExtensions)
    ];
  }
  const stableExtensions = stableExtensionsRef.current;

  /**
   * Reconfigures core extensions when theme, language, lint, or variable tooling changes.
   */
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({ effects: coreCompartment.reconfigure(coreExtensions) });
  }, [coreCompartment, coreExtensions]);

  /**
   * Reconfigures completion extensions when slash commands or host completion changes.
   */
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({ effects: completionCompartment.reconfigure(completionExtensions) });
  }, [completionCompartment, completionExtensions]);

  /**
   * Reconfigures accessibility attributes when aria props or id change.
   */
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({ effects: a11yCompartment.reconfigure(a11yExtensions) });
  }, [a11yCompartment, a11yExtensions]);

  /**
   * Reconfigures placeholder ghost layers when placeholder text or theme changes.
   */
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({ effects: placeholderCompartment.reconfigure(placeholderExtensions) });
  }, [placeholderCompartment, placeholderExtensions]);

  /**
   * Reconfigures host diagnostic markers when the diagnostics prop changes.
   *
   * Forces an immediate lint pass so the underline does not wait on the
   * combined syntax-linter delay (facet combines delay with Math.max).
   */
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({ effects: diagnosticsCompartment.reconfigure(diagnosticsExtensions) });
    if (diagnosticsExtensions.length > 0) {
      forceLinting(view);
    }
  }, [diagnosticsCompartment, diagnosticsExtensions]);

  /**
   * Resolves CodeMirror basicSetup from persisted settings or read-only defaults.
   */
  const basicSetup = useMemo(() => {
    if (!resolvedSetup) {
      return {
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        autocompletion: false,
        closeBrackets: false,
        indentOnInput: false
      };
    }

    if (readOnly) {
      return {
        lineNumbers: resolvedSetup.lineNumbers,
        foldGutter: resolvedSetup.foldGutter,
        highlightActiveLine: resolvedSetup.highlightActiveLine,
        highlightActiveLineGutter: resolvedSetup.highlightActiveLineGutter,
        highlightSelectionMatches: false,
        autocompletion: false,
        closeBrackets: false,
        indentOnInput: false
      };
    }

    // Disable the built-in autocompletion and completion keymap: this component
    // installs its own autocompletion() for JavaScript editors, ordered after the
    // slash-command Enter handler. Leaving basicSetup's autocompletion enabled would
    // inject a competing Prec.highest Enter->acceptCompletion binding ahead of ours,
    // swallowing the first Enter on a /ask line.
    return {
      lineNumbers: resolvedSetup.lineNumbers,
      foldGutter: resolvedSetup.foldGutter,
      highlightActiveLine: resolvedSetup.highlightActiveLine,
      highlightActiveLineGutter: resolvedSetup.highlightActiveLineGutter,
      highlightSelectionMatches: false,
      autocompletion: false,
      completionKeymap: false
    };
  }, [resolvedSetup, readOnly]);

  const wrapperClassName = readOnly
    ? `hc-code-editor overflow-hidden rounded-lg bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag ${className}`
    : `hc-code-editor min-h-36 resize-y overflow-hidden rounded-lg border border-separator bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--mac-accent)_35%,transparent),inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag ${className}`;

  const selectionTooltipContent = selectionTooltip
    ? getVariableTooltipContent(selectionTooltip.key, variables ?? [])
    : null;

  const wrapperStyle = height ? { height } : undefined;
  const activeSelectionActions = selectionActionsRef.current ?? [];
  const selectionActionToolbarNode =
    selectionActionToolbar && hasSelectionActions ? (
      <div
        ref={selectionToolbarElementRef}
        role="toolbar"
        aria-label="Selection actions"
        className="hc-code-editor-selection-toolbar app-no-drag pointer-events-auto fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1 bg-transparent p-0 text-[14px] text-text"
        style={{
          top: selectionActionToolbar.top - SELECTION_TOOLBAR_OFFSET_PX,
          left: selectionActionToolbar.left
        }}
      >
        {activeSelectionActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="hc-code-editor-selection-action inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-separator bg-control px-2 py-1 text-[14px] text-text shadow-sm hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            aria-label={action.ariaLabel}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              action.onSelect({
                text: selectionActionToolbar.text,
                from: selectionActionToolbar.from,
                to: selectionActionToolbar.to
              });
              setSelectionActionToolbar(null);
            }}
          >
            {action.icon ? <FaIcon icon={action.icon} className="h-3.5 w-3.5" /> : null}
            <span>{action.label}</span>
            {action.shortcutHint ? (
              <span className="text-[14px] text-muted">{action.shortcutHint}</span>
            ) : null}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div ref={wrapperRef} {...props} className={wrapperClassName} style={wrapperStyle}>
      {createElement(CodeMirrorImport, {
        value,
        onChange: readOnly ? undefined : stableOnChange,
        extensions: stableExtensions,
        theme: 'none',
        editable: resolvedEditable,
        readOnly,
        placeholder: useHighlightedPlaceholder ? undefined : placeholder,
        minHeight,
        ...(height ? { height: '100%' } : {}),
        basicSetup,
        onCreateEditor: stableOnCreateEditor
      })}
      {selectionTooltip && selectionTooltipContent && variables ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="hc-code-editor-tooltip app-no-drag pointer-events-auto fixed z-50 flex max-w-sm -translate-x-1/2 -translate-y-full flex-col gap-1.5 rounded-lg border border-separator bg-surface px-3 py-2 text-text shadow-md"
          style={{ top: selectionTooltip.top - 4, left: selectionTooltip.left }}
        >
          <VariableTooltipValue
            value={selectionTooltipContent.text}
            variableKey={selectionTooltip.key}
            muted={selectionTooltipContent.muted}
          />
          {onEditVariable ? (
            <Button
              variant="secondary"
              className="hc-code-editor-tooltip-edit self-start"
              aria-label={`Edit value for ${selectionTooltip.key}`}
              onMouseDown={(event) => {
                event.preventDefault();
                onEditVariable(selectionTooltip.key);
                setSelectionTooltip(null);
              }}
            >
              Edit value
            </Button>
          ) : null}
        </div>
      ) : null}
      {selectionActionToolbarNode ? portalToBody(selectionActionToolbarNode) : null}
    </div>
  );
}
