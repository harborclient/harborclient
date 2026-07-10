import type { ScriptRef, Snippet } from '#/shared/types';

/**
 * Regex matching `@<request-id>.<pre|post>.<script-index>` script references in chat text,
 * with an optional `#<selection-start>.<selection-end>` suffix for selected code ranges.
 */
export const AI_SCRIPT_REFERENCE_PATTERN =
  /@(active|\d+)\.(pre|post)\.(\d+)(?:#(\d+)\.(\d+))?(?!\d)/g;

/**
 * A parsed `@` script reference with character offsets in the source text.
 */
export interface ParsedAiScriptReference {
  /**
   * Saved request id from the reference, or the literal `active`.
   */
  requestId: number | 'active';

  /**
   * Script phase: pre-request or post-request.
   */
  phase: 'pre' | 'post';

  /**
   * 1-based index of the script in the phase array.
   */
  scriptIndex: number;

  /**
   * Start offset of the full `@` token in the source text.
   */
  start: number;

  /**
   * End offset (exclusive) of the full `@` token in the source text.
   */
  end: number;

  /**
   * Exact matched substring, including the leading `@`.
   */
  text: string;

  /**
   * Character offsets into the referenced script source when the user selected a range.
   */
  selection?: {
    /**
     * Start offset (inclusive) in the script source.
     */
    start: number;

    /**
     * End offset (exclusive) in the script source.
     */
    end: number;
  };
}

/**
 * Active request tab state used to decide whether an `@` reference is highlightable.
 */
export interface AiScriptReferenceValidationContext {
  /**
   * Whether the active tab hosts a request editor draft.
   */
  hasActiveRequestTab: boolean;

  /**
   * Saved request id on the active draft, when the tab is saved.
   */
  activeRequestId?: number;

  /**
   * Number of pre-request scripts on the active draft.
   */
  preScriptCount: number;

  /**
   * Number of post-request scripts on the active draft.
   */
  postScriptCount: number;

  /**
   * Pre-request script rows on the active draft, when available for name resolution.
   */
  preScripts?: ScriptRef[];

  /**
   * Post-request script rows on the active draft, when available for name resolution.
   */
  postScripts?: ScriptRef[];

  /**
   * Snippet library used to resolve snippet-linked script names.
   */
  snippets?: Snippet[];
}

/**
 * One render segment for the chat composer backdrop.
 */
export interface ChatComposerTextToken {
  /**
   * Substring from the composer draft.
   */
  text: string;

  /**
   * When true, the segment is a valid `@` script reference and should be highlighted.
   */
  highlight: boolean;

  /**
   * Parsed reference metadata when {@link highlight} is true.
   */
  reference?: ParsedAiScriptReference;
}

/**
 * Returns whether `@` at `index` is at a token boundary (start of text or after whitespace).
 *
 * @param text - Full composer draft.
 * @param index - Index of the `@` character.
 */
function isScriptReferenceBoundary(text: string, index: number): boolean {
  if (index === 0) {
    return true;
  }

  const previous = text[index - 1];
  return previous != null && /\s/.test(previous);
}

/**
 * Parses one regex match into a structured script reference.
 *
 * @param match - RegExp match for {@link AI_SCRIPT_REFERENCE_PATTERN}.
 */
function parseScriptReferenceMatch(match: RegExpMatchArray): ParsedAiScriptReference | null {
  const text = match[0];
  const start = match.index ?? 0;
  const requestIdRaw = match[1];
  const phase = match[2];
  const scriptIndexRaw = match[3];
  const selectionStartRaw = match[4];
  const selectionEndRaw = match[5];

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

  let selection: ParsedAiScriptReference['selection'];
  if (selectionStartRaw != null && selectionEndRaw != null) {
    const selectionStart = Number(selectionStartRaw);
    const selectionEnd = Number(selectionEndRaw);
    if (
      Number.isInteger(selectionStart) &&
      Number.isInteger(selectionEnd) &&
      selectionStart >= 0 &&
      selectionEnd > selectionStart
    ) {
      selection = { start: selectionStart, end: selectionEnd };
    }
  }

  return {
    requestId,
    phase,
    scriptIndex,
    start,
    end: start + text.length,
    text,
    selection
  };
}

/**
 * Finds syntactically valid `@` script reference candidates in plain text.
 *
 * @param text - Composer draft that may contain `@` references.
 */
export function findAiScriptReferenceCandidates(text: string): ParsedAiScriptReference[] {
  const matches: ParsedAiScriptReference[] = [];
  const pattern = new RegExp(AI_SCRIPT_REFERENCE_PATTERN.source, 'g');

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (!isScriptReferenceBoundary(text, start)) {
      continue;
    }

    const parsed = parseScriptReferenceMatch(match);
    if (parsed) {
      matches.push(parsed);
    }
  }

  return matches;
}

/**
 * Removes valid `@` script reference tokens from plain text.
 *
 * @param text - Composer or title prompt text that may contain `@` references.
 * @returns Text with script references removed and whitespace collapsed.
 */
export function stripAiScriptReferences(text: string): string {
  const candidates = findAiScriptReferenceCandidates(text);
  if (candidates.length === 0) {
    return text.replace(/\s+/g, ' ').trim();
  }

  let stripped = text;
  for (const candidate of [...candidates].sort((left, right) => right.start - left.start)) {
    stripped = stripped.slice(0, candidate.start) + stripped.slice(candidate.end);
  }

  return stripped.replace(/\s+/g, ' ').trim();
}

/**
 * Returns whether a parsed `@` reference resolves against the active request tab.
 *
 * Mirrors `update_request_script` validation in the AI tool executor.
 *
 * @param reference - Parsed `@` script reference.
 * @param context - Active tab script counts and request id.
 */
export function isValidAiScriptReference(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): boolean {
  if (!context.hasActiveRequestTab) {
    return false;
  }

  if (reference.requestId !== 'active' && reference.requestId !== context.activeRequestId) {
    return false;
  }

  const scriptCount = reference.phase === 'pre' ? context.preScriptCount : context.postScriptCount;

  return reference.scriptIndex >= 1 && reference.scriptIndex <= scriptCount;
}

/**
 * Returns the display name for a script row, matching the request editor list labels.
 *
 * @param script - Script reference entry from the active draft.
 * @param snippets - Snippet library lookup source.
 */
function scriptReferenceDisplayName(script: ScriptRef, snippets: Snippet[]): string {
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
 * Resolves the display name for a valid `@` script reference on the active request tab.
 *
 * @param reference - Parsed `@` script reference.
 * @param context - Active tab script rows and snippet library.
 * @returns Script name when resolvable, otherwise null.
 */
export function resolveAiScriptReferenceName(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  const scripts = reference.phase === 'pre' ? context.preScripts : context.postScripts;
  if (scripts == null) {
    return null;
  }

  const script = scripts[reference.scriptIndex - 1];
  if (script == null) {
    return null;
  }

  return scriptReferenceDisplayName(script, context.snippets ?? []);
}

/**
 * Resolves the JavaScript source for a script row on the active request tab.
 *
 * @param script - Script reference entry from the active draft.
 * @param snippets - Snippet library lookup source.
 * @returns Script source text, or null when unavailable.
 */
function resolveScriptSourceCode(script: ScriptRef, snippets: Snippet[]): string | null {
  if (script.kind === 'inline') {
    return script.code ?? '';
  }

  if (script.kind === 'snippet') {
    const linkedSnippet = snippets.find((entry) => entry.uuid === script.snippetUuid);
    return linkedSnippet?.code ?? null;
  }

  return null;
}

/**
 * Returns the 1-based line number for a character offset in script source.
 *
 * @param source - Script source text.
 * @param offset - Character offset into the source.
 */
function lineNumberAtOffset(source: string, offset: number): number {
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
function formatScriptSelectionLineRange(
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
 * Resolves the badge label for a valid `@` script reference, including selection line ranges.
 *
 * @param reference - Parsed `@` script reference.
 * @param context - Active tab script rows and snippet library.
 * @returns Script name with optional line range, or null when not resolvable.
 */
export function resolveAiScriptReferenceLabel(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  const name = resolveAiScriptReferenceName(reference, context);
  if (name == null) {
    return null;
  }

  if (reference.selection == null) {
    return name;
  }

  const scripts = reference.phase === 'pre' ? context.preScripts : context.postScripts;
  if (scripts == null) {
    return name;
  }

  const script = scripts[reference.scriptIndex - 1];
  if (script == null) {
    return name;
  }

  const source = resolveScriptSourceCode(script, context.snippets ?? []);
  if (source == null) {
    return name;
  }

  return `${name} ${formatScriptSelectionLineRange(source, reference.selection)}`;
}

/**
 * Clamps selection offsets to script source bounds and returns the selected substring.
 *
 * @param source - Full script source text.
 * @param selection - Character offsets from the `@` reference suffix.
 */
function clampScriptSelection(
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
 */
function formatScriptSelectionLineSpan(
  source: string,
  selection: { start: number; end: number }
): string {
  return formatScriptSelectionLineRange(source, selection).replace(/^\(|\)$/g, '');
}

/**
 * Formats one resolved selection reference for the agent context block.
 *
 * @param reference - Parsed `@` script reference with a selection suffix.
 * @param context - Active tab script rows and snippet library.
 * @returns Context block for one reference, or null when not resolvable.
 */
function formatScriptSelectionContextBlock(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (reference.selection == null || !isValidAiScriptReference(reference, context)) {
    return null;
  }

  const scripts = reference.phase === 'pre' ? context.preScripts : context.postScripts;
  const script = scripts?.[reference.scriptIndex - 1];
  if (script == null) {
    return null;
  }

  const source = resolveScriptSourceCode(script, context.snippets ?? []);
  if (source == null) {
    return null;
  }

  const name = resolveAiScriptReferenceName(reference, context) ?? 'Unnamed script';
  const clampedSelection = clampScriptSelection(source, reference.selection);
  const phaseLabel = reference.phase === 'pre' ? 'pre-request' : 'post-request';
  const requestLabel =
    reference.requestId === 'active'
      ? 'of the active request'
      : `of request id ${reference.requestId}`;
  const lineSpan = formatScriptSelectionLineSpan(source, clampedSelection);

  return [
    `Reference ${reference.text} — script "${name}" (${phaseLabel} script ${reference.scriptIndex} ${requestLabel}).`,
    'Full script source:',
    '```js',
    source,
    '```',
    `Selected text (characters ${clampedSelection.start}–${clampedSelection.end}, ${lineSpan}):`,
    '```js',
    clampedSelection.text,
    '```'
  ].join('\n');
}

/**
 * Builds an ephemeral system message that expands `@` script references with selection suffixes.
 *
 * The returned text is injected into the LLM step messages only; it is not persisted in chat
 * history so the composer can keep rendering compact badges.
 *
 * @param text - User message that may contain `@` script references.
 * @param context - Active tab script rows and snippet library.
 * @returns Formatted context block, or null when no valid selection references are present.
 */
export function buildAiScriptSelectionContextMessage(
  text: string,
  context: AiScriptReferenceValidationContext
): string | null {
  const blocks = findAiScriptReferenceCandidates(text)
    .map((reference) => formatScriptSelectionContextBlock(reference, context))
    .filter((block): block is string => block != null);

  if (blocks.length === 0) {
    return null;
  }

  const header =
    'The user selected part of a script and is asking specifically about the SELECTED TEXT below.';
  const footer =
    'Focus your answer and any script edits on the selected region. When editing, use update_request_script with the same phase and scriptIndex from the reference, and respect the #start.end character offsets from the @ tag.';

  return [header, '', ...blocks, '', footer].join('\n');
}

/**
 * Splits composer text into plain and highlightable `@` script reference segments.
 *
 * @param text - Composer draft.
 * @param context - Active tab state for semantic validation.
 */
export function tokenizeChatComposerText(
  text: string,
  context: AiScriptReferenceValidationContext
): ChatComposerTextToken[] {
  const candidates = findAiScriptReferenceCandidates(text);
  const tokens: ChatComposerTextToken[] = [];
  let lastIndex = 0;

  for (const candidate of candidates) {
    if (candidate.start < lastIndex) {
      continue;
    }

    const highlight = isValidAiScriptReference(candidate, context);

    if (candidate.start > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, candidate.start), highlight: false });
    }

    tokens.push({
      text: candidate.text,
      highlight,
      reference: highlight ? candidate : undefined
    });
    lastIndex = candidate.end;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), highlight: false });
  }

  return tokens;
}
