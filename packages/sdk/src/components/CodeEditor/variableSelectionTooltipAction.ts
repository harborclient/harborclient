/**
 * Action for the keyboard-driven {{variable}} selection tooltip.
 *
 * - `show` — open or reposition the React tooltip
 * - `hide` — dismiss it
 * - `ignore` — leave the current open/closed state unchanged
 */
export type VariableSelectionTooltipAction = 'show' | 'hide' | 'ignore';

/**
 * Decides whether a CodeMirror update should open, hide, or leave alone the
 * caret-driven variable tooltip.
 *
 * Pointer caret placement must not open this sticky React popup — mouse users
 * already get CodeMirror's hover tooltip, which dismisses on leave. Opening on
 * click left the popup stuck whenever the whole field was a single `{{variable}}`
 * (caret never left the token). Keyboard selection still opens it; document
 * edits only reposition an already-open tooltip so typing after a click does
 * not re-stick it.
 *
 * @param options.hasMatch - Whether the caret is inside a {{variable}} token.
 * @param options.selectionSet - Whether the update changed the selection.
 * @param options.docChanged - Whether the update changed the document.
 * @param options.pointerSelect - Whether any transaction was a pointer select.
 * @param options.isOpen - Whether the React selection tooltip is currently open.
 * @returns Whether to show, hide, or ignore the tooltip for this update.
 */
export function resolveVariableSelectionTooltipAction(options: {
  hasMatch: boolean;
  selectionSet: boolean;
  docChanged: boolean;
  pointerSelect: boolean;
  isOpen: boolean;
}): VariableSelectionTooltipAction {
  if (!options.hasMatch) {
    return 'hide';
  }

  if (options.pointerSelect) {
    return 'hide';
  }

  if (options.selectionSet) {
    return 'show';
  }

  if (options.docChanged) {
    return options.isOpen ? 'show' : 'ignore';
  }

  return 'ignore';
}
