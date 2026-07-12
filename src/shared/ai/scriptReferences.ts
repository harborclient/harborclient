import type { ScriptRef, Snippet } from '#/shared/types';

const AI_SCRIPT_REFERENCE_UUID =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/**
 * Regex matching `@` script references in chat text:
 * - Request scripts: `@<request-id>.<pre|post>.<script-index>`
 * - Standalone snippets: `@snippet.<uuid>`
 * - Footer terminals: `@term.<terminal-index>`
 * - Collections: `@collection.<uuid>`
 * - Folders: `@folder.<uuid>`
 * - Saved requests: `@request.<uuid>`
 *
 * Request scripts and snippets accept an optional `#<selection-start>.<selection-end>` suffix
 * (character offsets). Terminal references use the same suffix for 1-based line numbers.
 */
export const AI_SCRIPT_REFERENCE_PATTERN = new RegExp(
  `@(?:(active|\\d+)\\.(pre|post)\\.(\\d+)|snippet\\.(${AI_SCRIPT_REFERENCE_UUID})|term\\.(\\d+)|collection\\.(${AI_SCRIPT_REFERENCE_UUID})|folder\\.(${AI_SCRIPT_REFERENCE_UUID})|request\\.(${AI_SCRIPT_REFERENCE_UUID}))(?:#(\\d+)\\.(\\d+))?(?!\\d)`,
  'g'
);

/**
 * Shared fields for every parsed `@` script reference.
 */
interface ParsedAiScriptReferenceBase {
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
 * A parsed `@` reference to a request script row.
 */
export interface ParsedRequestScriptReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for request-script references.
   */
  kind: 'request-script';

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
}

/**
 * A parsed `@` reference to a standalone library snippet.
 */
export interface ParsedSnippetReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for standalone snippet references.
   */
  kind: 'snippet';

  /**
   * UUID of the snippet in the library.
   */
  snippetUuid: string;
}

/**
 * A parsed `@` reference to a footer terminal selection.
 */
export interface ParsedTerminalReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for footer terminal references.
   */
  kind: 'terminal';

  /**
   * 1-based index of the terminal tab in the footer switcher.
   */
  terminalIndex: number;
}

/**
 * A parsed `@` reference to a collection in the sidebar.
 */
export interface ParsedCollectionReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for collection references.
   */
  kind: 'collection';

  /**
   * UUID of the collection.
   */
  collectionUuid: string;
}

/**
 * A parsed `@` reference to a folder in the sidebar.
 */
export interface ParsedFolderReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for folder references.
   */
  kind: 'folder';

  /**
   * UUID of the folder.
   */
  folderUuid: string;
}

/**
 * A parsed `@` reference to a saved request in the sidebar.
 */
export interface ParsedRequestReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for saved-request references.
   */
  kind: 'request';

  /**
   * UUID of the saved request.
   */
  requestUuid: string;
}

/**
 * Snapshot of terminal output captured when the user copies a selection to chat.
 */
export interface TerminalSelectionSnapshot {
  /**
   * Display label of the terminal tab at capture time.
   */
  terminalLabel: string;

  /**
   * 1-based start line of the selection in the xterm buffer.
   */
  startLine: number;

  /**
   * 1-based end line of the selection in the xterm buffer.
   */
  endLine: number;

  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * Surrounding terminal lines included for agent context.
   */
  contextText: string;
}

/**
 * A parsed `@` script reference with character offsets in the source text.
 */
export type ParsedAiScriptReference =
  | ParsedRequestScriptReference
  | ParsedSnippetReference
  | ParsedTerminalReference
  | ParsedCollectionReference
  | ParsedFolderReference
  | ParsedRequestReference;

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

  /**
   * Terminal selection snapshots keyed by the full `@term` reference token.
   */
  terminalSelections?: Record<string, TerminalSelectionSnapshot>;

  /**
   * Collection display names keyed by uuid for `@collection` badge resolution.
   */
  collectionNamesByUuid?: Record<string, string>;

  /**
   * Folder display names keyed by uuid for `@folder` badge resolution.
   */
  folderNamesByUuid?: Record<string, string>;

  /**
   * Saved request display names keyed by uuid for `@request` badge resolution.
   */
  requestNamesByUuid?: Record<string, string>;
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
 * Parses selection suffix groups from a regex match.
 *
 * @param selectionStartRaw - Captured selection start group.
 * @param selectionEndRaw - Captured selection end group.
 * @param lineRange - When true, requires 1-based line numbers with end >= start.
 */
function parseSelectionSuffix(
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
 * Parses one regex match into a structured script reference.
 *
 * @param match - RegExp match for {@link AI_SCRIPT_REFERENCE_PATTERN}.
 * @param start - Document start offset of the match.
 */
export function parseAiScriptReferenceMatch(
  match: RegExpMatchArray,
  start: number
): ParsedAiScriptReference | null {
  const text = match[0];
  const requestIdRaw = match[1];
  const phase = match[2];
  const scriptIndexRaw = match[3];
  const snippetUuid = match[4];
  const terminalIndexRaw = match[5];
  const collectionUuid = match[6];
  const folderUuid = match[7];
  const requestUuid = match[8];
  const selectionStartRaw = match[9];
  const selectionEndRaw = match[10];

  if (collectionUuid != null) {
    return {
      kind: 'collection',
      collectionUuid,
      start,
      end: start + text.length,
      text
    };
  }

  if (folderUuid != null) {
    return {
      kind: 'folder',
      folderUuid,
      start,
      end: start + text.length,
      text
    };
  }

  if (requestUuid != null) {
    return {
      kind: 'request',
      requestUuid,
      start,
      end: start + text.length,
      text
    };
  }

  if (terminalIndexRaw != null) {
    const terminalIndex = Number(terminalIndexRaw);
    if (!Number.isInteger(terminalIndex) || terminalIndex < 1) {
      return null;
    }

    return {
      kind: 'terminal',
      terminalIndex,
      start,
      end: start + text.length,
      text,
      selection: parseSelectionSuffix(selectionStartRaw, selectionEndRaw, true)
    };
  }

  const selection = parseSelectionSuffix(selectionStartRaw, selectionEndRaw);

  if (snippetUuid != null) {
    return {
      kind: 'snippet',
      snippetUuid,
      start,
      end: start + text.length,
      text,
      selection
    };
  }

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
    kind: 'request-script',
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

    const parsed = parseAiScriptReferenceMatch(match, start);
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
 * Returns whether a parsed `@` reference resolves against the active request tab or snippet library.
 *
 * Mirrors `update_request_script` validation in the AI tool executor for request-script kind.
 *
 * @param reference - Parsed `@` script reference.
 * @param context - Active tab script counts, request id, and snippet library.
 */
export function isValidAiScriptReference(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): boolean {
  if (reference.kind === 'terminal') {
    if (reference.selection == null) {
      return false;
    }

    return context.terminalSelections?.[reference.text] != null;
  }

  if (reference.kind === 'snippet') {
    return (context.snippets ?? []).some((entry) => entry.uuid === reference.snippetUuid);
  }

  if (reference.kind === 'collection') {
    return context.collectionNamesByUuid?.[reference.collectionUuid] != null;
  }

  if (reference.kind === 'folder') {
    return context.folderNamesByUuid?.[reference.folderUuid] != null;
  }

  if (reference.kind === 'request') {
    return context.requestNamesByUuid?.[reference.requestUuid] != null;
  }

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
 * Resolves the display name for a valid `@` script reference.
 *
 * @param reference - Parsed `@` script reference.
 * @param context - Active tab script rows and snippet library.
 * @returns Script or snippet name when resolvable, otherwise null.
 */
export function resolveAiScriptReferenceName(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  if (reference.kind === 'terminal') {
    return context.terminalSelections?.[reference.text]?.terminalLabel ?? null;
  }

  if (reference.kind === 'snippet') {
    const snippet = (context.snippets ?? []).find((entry) => entry.uuid === reference.snippetUuid);
    return snippet?.name ?? null;
  }

  if (reference.kind === 'collection') {
    const name = context.collectionNamesByUuid?.[reference.collectionUuid];
    return name != null ? `Collection: ${name}` : null;
  }

  if (reference.kind === 'folder') {
    const name = context.folderNamesByUuid?.[reference.folderUuid];
    return name != null ? `Folder: ${name}` : null;
  }

  if (reference.kind === 'request') {
    const name = context.requestNamesByUuid?.[reference.requestUuid];
    return name != null ? `Request: ${name}` : null;
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
 * Resolves the JavaScript source for a parsed `@` reference.
 *
 * @param reference - Parsed `@` script reference.
 * @param context - Active tab script rows and snippet library.
 * @returns Script or snippet source text, or null when unavailable.
 */
function resolveReferenceSourceCode(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (
    reference.kind === 'terminal' ||
    reference.kind === 'collection' ||
    reference.kind === 'folder' ||
    reference.kind === 'request'
  ) {
    return null;
  }

  if (reference.kind === 'snippet') {
    const snippet = (context.snippets ?? []).find((entry) => entry.uuid === reference.snippetUuid);
    return snippet?.code ?? null;
  }

  const scripts = reference.phase === 'pre' ? context.preScripts : context.postScripts;
  const script = scripts?.[reference.scriptIndex - 1];
  if (script == null) {
    return null;
  }

  return resolveScriptSourceCode(script, context.snippets ?? []);
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
/**
 * Formats a terminal line span for badge labels.
 *
 * @param startLine - 1-based start line of the selection.
 * @param endLine - 1-based end line of the selection.
 */
function formatTerminalSelectionLineRange(startLine: number, endLine: number): string {
  if (startLine === endLine) {
    return `(line ${startLine})`;
  }

  return `(lines ${startLine}-${endLine})`;
}

export function resolveAiScriptReferenceLabel(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  const name = resolveAiScriptReferenceName(reference, context);
  if (name == null) {
    return null;
  }

  if (reference.kind === 'terminal') {
    const snapshot = context.terminalSelections?.[reference.text];
    if (snapshot == null) {
      return name;
    }

    return `${name} ${formatTerminalSelectionLineRange(snapshot.startLine, snapshot.endLine)}`;
  }

  if (reference.selection == null) {
    return name;
  }

  const source = resolveReferenceSourceCode(reference, context);
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
 * Formats one resolved terminal selection reference for the agent context block.
 *
 * @param reference - Parsed `@term` reference with a line-range suffix.
 * @param context - Terminal selection snapshots keyed by reference token.
 * @returns Context block for one terminal reference, or null when not resolvable.
 */
function formatTerminalSelectionContextBlock(
  reference: ParsedTerminalReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (reference.selection == null || !isValidAiScriptReference(reference, context)) {
    return null;
  }

  const snapshot = context.terminalSelections?.[reference.text];
  if (snapshot == null) {
    return null;
  }

  const lineSpan =
    snapshot.startLine === snapshot.endLine
      ? `line ${snapshot.startLine}`
      : `lines ${snapshot.startLine}-${snapshot.endLine}`;

  return [
    `Reference ${reference.text} — footer terminal "${snapshot.terminalLabel}" (terminal ${reference.terminalIndex} in the tab list).`,
    `Selected terminal output (${lineSpan}):`,
    '```text',
    snapshot.selectedText,
    '```',
    'Surrounding terminal context (includes lines before and after the selection):',
    '```text',
    snapshot.contextText,
    '```'
  ].join('\n');
}

function formatScriptSelectionContextBlock(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (reference.kind === 'terminal') {
    return formatTerminalSelectionContextBlock(reference, context);
  }

  if (reference.selection == null || !isValidAiScriptReference(reference, context)) {
    return null;
  }

  const source = resolveReferenceSourceCode(reference, context);
  if (source == null) {
    return null;
  }

  const name = resolveAiScriptReferenceName(reference, context) ?? 'Unnamed script';
  const clampedSelection = clampScriptSelection(source, reference.selection);
  const lineSpan = formatScriptSelectionLineSpan(source, clampedSelection);

  if (reference.kind === 'snippet') {
    return [
      `Reference ${reference.text} — standalone library snippet "${name}" (not linked to any specific request).`,
      'Full snippet source:',
      '```js',
      source,
      '```',
      `Selected text (characters ${clampedSelection.start}–${clampedSelection.end}, ${lineSpan}):`,
      '```js',
      clampedSelection.text,
      '```'
    ].join('\n');
  }

  if (reference.kind !== 'request-script') {
    return null;
  }

  const phaseLabel = reference.phase === 'pre' ? 'pre-request' : 'post-request';
  const requestLabel =
    reference.requestId === 'active'
      ? 'of the active request'
      : `of request id ${reference.requestId}`;

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
  const candidates = findAiScriptReferenceCandidates(text);
  const blocks = candidates
    .map((reference) => formatScriptSelectionContextBlock(reference, context))
    .filter((block): block is string => block != null);

  if (blocks.length === 0) {
    return null;
  }

  const hasTerminalReference = candidates.some(
    (reference) => reference.kind === 'terminal' && reference.selection != null
  );
  const hasRequestScriptReference = candidates.some(
    (reference) => reference.kind === 'request-script' && reference.selection != null
  );
  const hasSnippetReference = candidates.some(
    (reference) => reference.kind === 'snippet' && reference.selection != null
  );

  const headerParts: string[] = [];
  if (hasTerminalReference) {
    headerParts.push(
      'The user selected terminal output and is asking specifically about the SELECTED TEXT below.'
    );
  }
  if (hasRequestScriptReference || hasSnippetReference) {
    headerParts.push(
      'The user selected part of a script and is asking specifically about the SELECTED TEXT below.'
    );
  }

  const footerParts: string[] = ['Focus your answer on the selected region.'];

  if (hasTerminalReference) {
    footerParts.push(
      'Terminal output references cannot be edited via tools. Explain, diagnose, or suggest shell commands the user can run.'
    );
  }

  if (hasRequestScriptReference) {
    footerParts.push(
      'When editing request scripts, use update_request_script with the same phase and scriptIndex from the reference, and respect the #start.end character offsets from the @ tag.'
    );
  }

  if (hasSnippetReference) {
    footerParts.push(
      'Standalone library snippets referenced with @snippet.<uuid> cannot be edited via tools. Propose replacement code in your reply for the user to paste back into the snippet editor.'
    );
  }

  return [headerParts.join(' '), '', ...blocks, '', footerParts.join(' ')].join('\n');
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
