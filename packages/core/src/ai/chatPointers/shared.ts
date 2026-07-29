/**
 * Shared helpers for `@` chat-pointer parsing, labels, and context expansion.
 */

import type { ScriptRef, Snippet } from '../../types.js';
import type { ParsedAiScriptReference } from './types.js';

/**
 * Returns whether `@` at `index` is at a token boundary (start of text or after whitespace).
 *
 * @param text - Full composer draft.
 * @param index - Index of the `@` character.
 * @returns True when the `@` may start a chat pointer.
 */
export function isScriptReferenceBoundary(text: string, index: number): boolean {
  if (index === 0) {
    return true;
  }

  const previous = text[index - 1];
  return previous != null && /\s/.test(previous);
}

/**
 * Parses selection suffix groups from a regex match.
 *
 * @param selectionStartRaw - Captured selection start group.
 * @param selectionEndRaw - Captured selection end group.
 * @param lineRange - When true, requires 1-based line numbers with end >= start.
 * @returns Selection offsets, or undefined when absent/invalid.
 */
export function parseSelectionSuffix(
  selectionStartRaw: string | undefined,
  selectionEndRaw: string | undefined,
  lineRange = false
): ParsedAiScriptReference['selection'] {
  if (selectionStartRaw == null || selectionEndRaw == null) {
    return undefined;
  }

  const selectionStart = Number(selectionStartRaw);
  const selectionEnd = Number(selectionEndRaw);
  if (!Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd)) {
    return undefined;
  }

  if (lineRange) {
    if (selectionStart >= 1 && selectionEnd >= selectionStart) {
      return { start: selectionStart, end: selectionEnd };
    }

    return undefined;
  }

  if (selectionStart >= 0 && selectionEnd > selectionStart) {
    return { start: selectionStart, end: selectionEnd };
  }

  return undefined;
}

/**
 * Returns the display name for a script row, matching the request editor list labels.
 *
 * @param script - Script reference entry from the active draft.
 * @param snippets - Snippet library lookup source.
 * @returns Human-readable script label.
 */
export function scriptReferenceDisplayName(script: ScriptRef, snippets: Snippet[]): string {
  if (script.name?.trim()) {
    return script.name.trim();
  }

  if (script.kind === 'snippet') {
    const snippet = snippets.find((entry) => entry.uuid === script.snippetUuid);
    return snippet ? snippet.name : 'Missing snippet';
  }

  return 'Inline script';
}

/**
 * Returns the 1-based line number for a character offset in script source.
 *
 * @param source - Script source text.
 * @param offset - Character offset into the source.
 * @returns 1-based line number.
 */
export function lineNumberAtOffset(source: string, offset: number): number {
  const clamped = Math.min(Math.max(0, offset), source.length);
  let line = 1;

  for (let index = 0; index < clamped; index += 1) {
    if (source[index] === '\n') {
      line += 1;
    }
  }

  return line;
}

/**
 * Formats a selection range as a human-readable line span for badge labels.
 *
 * @param source - Script source text.
 * @param selection - Character offsets into the script source.
 * @returns Line span label such as `(line 3)` or `(lines 3-5)`.
 */
export function formatScriptSelectionLineRange(
  source: string,
  selection: NonNullable<ParsedAiScriptReference['selection']>
): string {
  const clampedStart = Math.min(Math.max(0, selection.start), source.length);
  const clampedEnd = Math.min(Math.max(clampedStart, selection.end), source.length);
  const startLine = lineNumberAtOffset(source, clampedStart);
  const endLine = lineNumberAtOffset(source, Math.max(clampedStart, clampedEnd - 1));

  if (startLine === endLine) {
    return `(line ${startLine})`;
  }

  return `(lines ${startLine}-${endLine})`;
}

/**
 * Formats a terminal/markdown/body line span for badge labels.
 *
 * @param startLine - 1-based start line of the selection.
 * @param endLine - 1-based end line of the selection.
 * @returns Line span label such as `(line 3)` or `(lines 3-5)`.
 */
export function formatTerminalSelectionLineRange(startLine: number, endLine: number): string {
  if (startLine === endLine) {
    return `(line ${startLine})`;
  }

  return `(lines ${startLine}-${endLine})`;
}

/**
 * Clamps selection offsets to script source bounds and returns the selected substring.
 *
 * @param source - Full script source text.
 * @param selection - Character offsets from the `@` reference suffix.
 * @returns Clamped offsets and selected text.
 */
export function clampScriptSelection(
  source: string,
  selection: NonNullable<ParsedAiScriptReference['selection']>
): { start: number; end: number; text: string } {
  const start = Math.min(Math.max(0, selection.start), source.length);
  const end = Math.min(Math.max(start, selection.end), source.length);

  return {
    start,
    end,
    text: source.slice(start, end)
  };
}

/**
 * Formats the line span label for agent context without surrounding parentheses.
 *
 * @param source - Script source text.
 * @param selection - Clamped character offsets into the script source.
 * @returns Line span without parentheses.
 */
export function formatScriptSelectionLineSpan(
  source: string,
  selection: { start: number; end: number }
): string {
  return formatScriptSelectionLineRange(source, selection).replace(/^\(|\)$/g, '');
}

/**
 * Inserts visible, non-source markers around a selected script range.
 *
 * @param source - Full script source.
 * @param startOffset - Inclusive selection start.
 * @param endOffset - Exclusive selection end.
 * @returns Full source with the selected span visibly delimited.
 */
export function markScriptSelection(
  source: string,
  startOffset: number,
  endOffset: number
): string {
  const start = Math.min(Math.max(0, startOffset), source.length);
  const end = Math.min(Math.max(start, endOffset), source.length);
  return `${source.slice(0, start)}<<<SEL>>>${source.slice(start, end)}<<</SEL>>>${source.slice(end)}`;
}

/**
 * Describes whether selected script text can safely accept a statement-level replacement.
 *
 * @param source - Full script source.
 * @param startOffset - Inclusive selection start.
 * @param endOffset - Exclusive selection end.
 * @returns Agent guidance matching the selection's syntactic shape.
 */
export function describeScriptSelectionShape(
  source: string,
  startOffset: number,
  endOffset: number
): string {
  const start = Math.min(Math.max(0, startOffset), source.length);
  const end = Math.min(Math.max(start, endOffset), source.length);
  const lineStart = source.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const beforeOnLine = source.slice(lineStart, start);
  const selectedText = source.slice(start, end).trim();
  const isStatementLike =
    beforeOnLine.trim() === '' && (selectedText.endsWith(';') || selectedText.endsWith('}'));

  return isStatementLike
    ? 'Selection shape: complete statement or block. replace_range code must be a drop-in replacement for exactly the marked span.'
    : 'Selection shape: partial expression. replace_range code must itself be an expression that fits between the unchanged text immediately before and after the markers. For a structural fix, use mode "replace" with the entire updated script.';
}

/**
 * Strips leading `^` / trailing `$` from a RegExp source for composition into alternations.
 *
 * @param source - RegExp source string.
 * @returns Source without outer anchors.
 */
export function stripRegexAnchors(source: string): string {
  let next = source;
  if (next.startsWith('^')) {
    next = next.slice(1);
  }
  if (next.endsWith('$')) {
    next = next.slice(0, -1);
  }
  return next;
}
