import type { ScriptRef, Snippet } from '../types';
import {
  type AiResponseSection,
  type AiScriptReferenceValidationContext,
  type ChatComposerTextToken,
  type ParsedAiScriptReference,
  type ParsedLiveServerReference,
  type ParsedLogsReference,
  type ParsedMarkdownReference,
  type ParsedPluginReference,
  type ParsedRequestBodyReference,
  type ParsedRequestScriptReference,
  type ParsedResponseSectionReference,
  type ParsedTerminalReference,
  type ParsedWebpageReference,
  type PersistedChatReferenceSnapshotEntry,
  type PersistedChatReferenceSnapshots,
  type ScriptSelectionLastRunFailure,
  type ScriptSelectionSnapshot
} from './chatPointers/types.js';
import { getRegisteredChatPointers } from './chatPointers/registry.js';
import { isScriptReferenceBoundary, stripRegexAnchors } from './chatPointers/shared.js';
import { bindBuiltinChatPointerHandlers } from './chatPointers/builtins/index.js';

export {
  registerBuiltinChatPointers,
  reinstallBuiltinChatPointersForTests,
  bindBuiltinChatPointerHandlers
} from './chatPointers/builtins/index.js';

export {
  AI_RESPONSE_SECTION_LABELS,
  AI_RESPONSE_SECTIONS,
  AI_SCRIPT_REFERENCE_UUID,
  type AiResponseSection,
  type AiScriptReferenceValidationContext,
  type ChatComposerTextToken,
  type ChatPointerDefinition,
  type ChatPointerContextMessageHints,
  type ParsedAiScriptReference,
  type ParsedAiScriptReferenceBase,
  type ParsedChatPointer,
  type ParsedCollectionReference,
  type ParsedFolderReference,
  type ParsedLiveServerReference,
  type ParsedLogsReference,
  type ParsedMarkdownReference,
  type ParsedPluginReference,
  type ParsedRequestBodyReference,
  type ParsedRequestReference,
  type ParsedRequestScriptReference,
  type ParsedResponseSectionReference,
  type ParsedSnippetReference,
  type ParsedTerminalReference,
  type ParsedWebpageReference,
  type PersistedChatReferenceSnapshotEntry,
  type PersistedChatReferenceSnapshots,
  type PluginChatPointerSnapshot,
  type RequestBodySelectionSnapshot,
  type ResponseSectionSnapshot,
  type ScriptSelectionLastRunFailure,
  type ScriptSelectionSnapshot,
  type TerminalSelectionSnapshot,
  type LogsSelectionSnapshot,
  type MarkdownSelectionSnapshot,
  type LiveServerReferenceInfo,
  type WebpageTabReferenceInfo
} from './chatPointers/types.js';

export {
  registerChatPointer,
  unregisterChatPointer,
  getChatPointer,
  getRegisteredChatPointers,
  getChatPointerAgentGuidance,
  registerPluginChatPointerGuidance,
  getPluginChatPointerGuidance,
  resetChatPointerRegistryForTests
} from './chatPointers/registry.js';

export {
  buildPluginChatPointerToken,
  isValidPluginChatPointerId,
  isValidPluginChatPointerKey,
  PLUGIN_CHAT_POINTER_ID_PATTERN,
  PLUGIN_CHAT_POINTER_KEY_PATTERN
} from './chatPointers/pluginToken.js';

/**
 * Regex matching `@` script references in chat text.
 *
 * Composed from registered chat-pointer definitions after builtins load.
 * Includes request scripts, snippets, terminals, collections, folders, requests,
 * webpages, live servers, markdown, response sections, raw body, and plugin pointers.
 */
export let AI_SCRIPT_REFERENCE_PATTERN = /@(?!)/g;

/**
 * Rebuilds {@link AI_SCRIPT_REFERENCE_PATTERN} from the chat-pointer registry.
 */
export function refreshAiScriptReferencePattern(): void {
  const defs = getRegisteredChatPointers();
  if (defs.length === 0) {
    AI_SCRIPT_REFERENCE_PATTERN = /@(?!)/g;
    return;
  }
  const alts = defs.map((def) => `(?:${stripRegexAnchors(def.match.source)})`);
  AI_SCRIPT_REFERENCE_PATTERN = new RegExp(`@(?:${alts.join('|')})(?!\\w)`, 'g');
}

/**
 * Builds the compact `@res` token for a response-viewer section on a request tab.
 *
 * @param requestTabId - UUID of the owning request tab.
 * @param section - Response section to reference.
 * @returns Token such as `@res.<uuid>.body`.
 */
export function buildResponseSectionReferenceToken(
  requestTabId: string,
  section: AiResponseSection
): string {
  return `@res.${requestTabId}.${section}`;
}

/**
 * Builds an `@res…body` token with a character-range selection suffix.
 *
 * Offsets are into the pretty-printed body viewer text (the same string shown in the
 * response Body CodeEditor), not the raw wire body.
 *
 * @param requestTabId - UUID of the owning request tab.
 * @param startOffset - Inclusive character offset of the selection.
 * @param endOffset - Exclusive character offset of the selection.
 * @returns Token such as `@res.<uuid>.body#12.48`.
 */
export function buildResponseBodySelectionReferenceToken(
  requestTabId: string,
  startOffset: number,
  endOffset: number
): string {
  return `${buildResponseSectionReferenceToken(requestTabId, 'body')}#${startOffset}.${endOffset}`;
}

/**
 * Builds the compact `@webpage` token for an embedded browser tab.
 *
 * When `click` is provided, appends `#x.y` viewport CSS pixel coordinates for
 * `document.elementFromPoint(x, y)` resolution.
 *
 * @param tabId - Browser tab UUID.
 * @param click - Optional viewport click point from the guest context menu.
 * @returns Token such as `@webpage.<uuid>` or `@webpage.<uuid>#120.80`.
 */
export function buildWebpageReferenceToken(
  tabId: string,
  click?: { x: number; y: number }
): string {
  if (click == null) {
    return `@webpage.${tabId}`;
  }

  const x = Math.max(0, Math.round(click.x));
  const y = Math.max(0, Math.round(click.y));
  return `@webpage.${tabId}#${x}.${y}`;
}

/**
 * Builds the compact `@live-server` token for a saved live server.
 *
 * @param uuid - Saved live server UUID.
 * @returns Token such as `@live-server.<uuid>`.
 */
export function buildLiveServerReferenceToken(uuid: string): string {
  return `@live-server.${uuid}`;
}

/**
 * Builds the compact `@logs` token for a saved live server's access logs.
 *
 * When `startLine` and `endLine` are provided, appends a 1-based line-range suffix
 * matching the displayed log buffer (same semantics as `@term.N#start.end`).
 *
 * @param uuid - Saved live server UUID.
 * @param startLine - Optional 1-based start line of the selection.
 * @param endLine - Optional 1-based end line of the selection.
 * @returns Token such as `@logs.<uuid>` or `@logs.<uuid>#1.40`.
 */
export function buildLogsReferenceToken(
  uuid: string,
  startLine?: number,
  endLine?: number
): string {
  if (
    startLine != null &&
    endLine != null &&
    Number.isInteger(startLine) &&
    Number.isInteger(endLine) &&
    startLine >= 1 &&
    endLine >= startLine
  ) {
    return `@logs.${uuid}#${startLine}.${endLine}`;
  }

  return `@logs.${uuid}`;
}

/**
 * Parses one `@` token match using the chat-pointer registry (longest body match wins).
 *
 * @param match - RegExp match whose `[0]` is the full `@…` token (from CodeMirror or composed pattern).
 * @param start - Document start offset of the match.
 * @returns Parsed reference, or null when no registered pointer matches.
 */
export function parseAiScriptReferenceMatch(
  match: RegExpMatchArray,
  start: number
): ParsedAiScriptReference | null {
  const text = match[0];
  if (!text.startsWith('@')) {
    return null;
  }

  const rest = text.slice(1);
  let best: ParsedAiScriptReference | null = null;
  let bestLen = -1;

  for (const def of getRegisteredChatPointers()) {
    const bodyMatch = rest.match(def.match);
    if (bodyMatch == null || bodyMatch.index !== 0) {
      continue;
    }
    if (bodyMatch[0] !== rest) {
      continue;
    }
    const parsed = def.parse(bodyMatch, text, start);
    if (parsed != null && bodyMatch[0].length > bestLen) {
      best = parsed;
      bestLen = bodyMatch[0].length;
    }
  }

  return best;
}

/**
 * Finds syntactically valid `@` script reference candidates in plain text.
 *
 * Scans `@` token boundaries and tries each registered chat-pointer match, keeping the
 * longest successful parse at each position.
 *
 * @param text - Composer draft that may contain `@` references.
 * @returns Parsed candidates in document order.
 */
export function findAiScriptReferenceCandidates(text: string): ParsedAiScriptReference[] {
  const matches: ParsedAiScriptReference[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '@' || !isScriptReferenceBoundary(text, index)) {
      continue;
    }

    const rest = text.slice(index + 1);
    let best: ParsedAiScriptReference | null = null;
    let bestLen = -1;

    for (const def of getRegisteredChatPointers()) {
      const bodyMatch = rest.match(def.match);
      if (bodyMatch == null || bodyMatch.index !== 0) {
        continue;
      }
      const fullToken = `@${bodyMatch[0]}`;
      const parsed = def.parse(bodyMatch, fullToken, index);
      if (parsed != null && bodyMatch[0].length > bestLen) {
        best = parsed;
        bestLen = bodyMatch[0].length;
      }
    }

    if (best != null) {
      matches.push(best);
      index = best.end - 1;
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
  if (reference.kind === 'plugin') {
    return context.pluginSelections?.[reference.text] != null;
  }

  if (reference.kind === 'markdown') {
    if (reference.selection == null) {
      return false;
    }

    return context.markdownSelections?.[reference.text] != null;
  }

  if (reference.kind === 'body') {
    if (reference.selection == null) {
      return false;
    }

    return context.requestBodySelections?.[reference.text] != null;
  }

  if (reference.kind === 'response-section') {
    return context.responseSelections?.[reference.text] != null;
  }

  if (reference.kind === 'terminal') {
    if (reference.selection == null) {
      return false;
    }

    return context.terminalSelections?.[reference.text] != null;
  }

  if (reference.kind === 'logs') {
    if (context.liveServersByUuid?.[reference.liveServerUuid] == null) {
      return false;
    }

    if (reference.selection != null) {
      return context.logsSelections?.[reference.text] != null;
    }

    return true;
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

  if (reference.kind === 'webpage') {
    return context.webpageTabsById?.[reference.tabId] != null;
  }

  if (reference.kind === 'live-server') {
    return context.liveServersByUuid?.[reference.liveServerUuid] != null;
  }

  // request-script kind below — snapshots satisfy both selection and whole-script refs
  if (context.scriptSelections?.[reference.text] != null) {
    return true;
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

  if (reference.kind === 'plugin') {
    return context.pluginSelections?.[reference.text]?.label ?? null;
  }

  if (reference.kind === 'terminal') {
    return context.terminalSelections?.[reference.text]?.terminalLabel ?? null;
  }

  if (reference.kind === 'logs') {
    const snapshot = context.logsSelections?.[reference.text];
    if (snapshot != null) {
      return snapshot.label;
    }

    const server = context.liveServersByUuid?.[reference.liveServerUuid];
    return server != null ? `Logs: ${server.name}` : null;
  }

  if (reference.kind === 'markdown') {
    return context.markdownSelections?.[reference.text]?.label ?? null;
  }

  if (reference.kind === 'body') {
    return context.requestBodySelections?.[reference.text]?.label ?? null;
  }

  if (reference.kind === 'response-section') {
    return context.responseSelections?.[reference.text]?.label ?? null;
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

  if (reference.kind === 'webpage') {
    const tab = context.webpageTabsById?.[reference.tabId];
    if (tab == null) {
      return null;
    }
    const title = tab.title.trim();
    return title.length > 0 ? title : tab.url;
  }

  if (reference.kind === 'live-server') {
    const server = context.liveServersByUuid?.[reference.liveServerUuid];
    return server != null ? `Live Server: ${server.name}` : null;
  }

  if (reference.kind === 'request-script') {
    const snapshot = context.scriptSelections?.[reference.text];
    if (snapshot != null) {
      return snapshot.scriptLabel;
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

  return null;
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
    reference.kind === 'logs' ||
    reference.kind === 'markdown' ||
    reference.kind === 'body' ||
    reference.kind === 'response-section' ||
    reference.kind === 'collection' ||
    reference.kind === 'folder' ||
    reference.kind === 'request' ||
    reference.kind === 'webpage' ||
    reference.kind === 'live-server' ||
    reference.kind === 'plugin'
  ) {
    return null;
  }

  if (reference.kind === 'snippet') {
    const snippet = (context.snippets ?? []).find((entry) => entry.uuid === reference.snippetUuid);
    return snippet?.code ?? null;
  }

  const snapshot = context.scriptSelections?.[reference.text];
  if (snapshot != null) {
    return snapshot.source;
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

  if (reference.kind === 'webpage' && reference.click != null) {
    return `${name} (${reference.click.x}, ${reference.click.y})`;
  }

  if (reference.kind === 'plugin') {
    return name;
  }

  if (reference.kind === 'terminal') {
    const snapshot = context.terminalSelections?.[reference.text];
    if (snapshot == null) {
      return name;
    }

    return `${name} ${formatTerminalSelectionLineRange(snapshot.startLine, snapshot.endLine)}`;
  }

  if (reference.kind === 'logs') {
    const snapshot = context.logsSelections?.[reference.text];
    if (snapshot == null) {
      return name;
    }

    return `${name} ${formatTerminalSelectionLineRange(snapshot.startLine, snapshot.endLine)}`;
  }

  if (reference.kind === 'markdown') {
    const snapshot = context.markdownSelections?.[reference.text];
    if (snapshot == null) {
      return name;
    }

    return `${name} ${formatTerminalSelectionLineRange(snapshot.startLine, snapshot.endLine)}`;
  }

  if (reference.kind === 'body') {
    const snapshot = context.requestBodySelections?.[reference.text];
    if (snapshot == null) {
      return name;
    }

    return `${name} ${formatTerminalSelectionLineRange(snapshot.startLine, snapshot.endLine)}`;
  }

  if (reference.kind === 'response-section') {
    const snapshot = context.responseSelections?.[reference.text];
    if (
      snapshot != null &&
      snapshot.startLine != null &&
      snapshot.endLine != null &&
      reference.selection != null
    ) {
      return `${name} ${formatTerminalSelectionLineRange(snapshot.startLine, snapshot.endLine)}`;
    }

    return name;
  }

  if (reference.kind === 'request-script' && reference.selection != null) {
    const snapshot = context.scriptSelections?.[reference.text];
    if (snapshot != null) {
      return `${name} ${formatTerminalSelectionLineRange(snapshot.startLine, snapshot.endLine)}`;
    }
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

/**
 * Formats one resolved live-server access-log selection reference for the agent context block.
 *
 * @param reference - Parsed `@logs` reference with a line-range suffix.
 * @param context - Log selection snapshots keyed by reference token.
 * @returns Context block for one logs reference, or null when not resolvable.
 */
function formatLogsSelectionContextBlock(
  reference: ParsedLogsReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (reference.selection == null || !isValidAiScriptReference(reference, context)) {
    return null;
  }

  const snapshot = context.logsSelections?.[reference.text];
  if (snapshot == null) {
    return null;
  }

  const lineSpan =
    snapshot.startLine === snapshot.endLine
      ? `line ${snapshot.startLine}`
      : `lines ${snapshot.startLine}-${snapshot.endLine}`;

  return [
    `Reference ${reference.text} — live server access logs "${snapshot.label}".`,
    `Selected access-log output (${lineSpan}):`,
    '```text',
    snapshot.selectedText,
    '```',
    'Surrounding access-log context (includes lines before and after the selection):',
    '```text',
    snapshot.contextText,
    '```'
  ].join('\n');
}

/**
 * Formats one resolved markdown selection reference for the agent context block.
 *
 * @param reference - Parsed `@markdown` reference with a character-range suffix.
 * @param context - Markdown selection snapshots keyed by reference token.
 * @returns Context block for one markdown reference, or null when not resolvable.
 */
function formatMarkdownSelectionContextBlock(
  reference: ParsedMarkdownReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (reference.selection == null || !isValidAiScriptReference(reference, context)) {
    return null;
  }

  const snapshot = context.markdownSelections?.[reference.text];
  if (snapshot == null) {
    return null;
  }

  const lineSpan =
    snapshot.startLine === snapshot.endLine
      ? `line ${snapshot.startLine}`
      : `lines ${snapshot.startLine}-${snapshot.endLine}`;

  return [
    `Reference ${reference.text} — markdown "${snapshot.label}".`,
    `Selected markdown text (characters ${snapshot.startOffset}–${snapshot.endOffset}, ${lineSpan}):`,
    '```markdown',
    snapshot.selectedText,
    '```',
    'Call get_markdown_document with the same uuid when you need the full document or comment source.'
  ].join('\n');
}

/**
 * Formats one resolved response-section reference for the agent context block.
 *
 * @param reference - Parsed `@res` reference.
 * @param context - Response-section snapshots keyed by reference token.
 * @returns Context block for one response section, or null when not resolvable.
 */
function formatResponseSectionContextBlock(
  reference: ParsedResponseSectionReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  const snapshot = context.responseSelections?.[reference.text];
  if (snapshot == null) {
    return null;
  }

  const statusLine =
    snapshot.status != null
      ? `Status: ${snapshot.status}${snapshot.statusText ? ` ${snapshot.statusText}` : ''}`
      : null;
  const truncationNote =
    snapshot.truncated && snapshot.originalLength != null
      ? `Content truncated from ${snapshot.originalLength} characters.`
      : null;

  const hasBodySelection =
    reference.selection != null &&
    snapshot.selectedText != null &&
    snapshot.startOffset != null &&
    snapshot.endOffset != null &&
    snapshot.startLine != null &&
    snapshot.endLine != null;

  if (hasBodySelection) {
    const lineSpan =
      snapshot.startLine === snapshot.endLine
        ? `line ${snapshot.startLine}`
        : `lines ${snapshot.startLine}-${snapshot.endLine}`;

    return [
      `Reference ${reference.text} — ${snapshot.label} for request "${snapshot.requestName}".`,
      statusLine,
      `Selected response body text (characters ${snapshot.startOffset}–${snapshot.endOffset}, ${lineSpan}; offsets are into the pretty-printed body viewer text):`,
      '```text',
      snapshot.selectedText,
      '```',
      truncationNote,
      'Surrounding section content (may be truncated):',
      '```text',
      snapshot.content,
      '```',
      'Focus on the selected region. Call get_active_request and get_active_request_details for the full request; call get_active_response_summary, get_active_response, or query_response_body when you need more of the live response or non-binary body than this snapshot provides. Response-section references cannot be edited via tools.'
    ]
      .filter((line): line is string => line != null && line.length > 0)
      .join('\n');
  }

  return [
    `Reference ${reference.text} — ${snapshot.label} for request "${snapshot.requestName}".`,
    statusLine,
    truncationNote,
    'Section content:',
    '```text',
    snapshot.content,
    '```',
    'Answer from this captured response-section context first. Call get_active_request and get_active_request_details for the full request; call get_active_response_summary, get_active_response, or query_response_body only when you need more detail than the snapshot provides (for example a longer body).'
  ]
    .filter((line): line is string => line != null && line.length > 0)
    .join('\n');
}

/**
 * Formats one resolved raw-body selection reference for the agent context block.
 *
 * @param reference - Parsed `@body` reference with a character-range suffix.
 * @param context - Raw-body selection snapshots keyed by reference token.
 * @returns Context block for one body reference, or null when not resolvable.
 */
function formatRequestBodySelectionContextBlock(
  reference: ParsedRequestBodyReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (reference.selection == null || !isValidAiScriptReference(reference, context)) {
    return null;
  }

  const snapshot = context.requestBodySelections?.[reference.text];
  if (snapshot == null) {
    return null;
  }

  const lineSpan =
    snapshot.startLine === snapshot.endLine
      ? `line ${snapshot.startLine}`
      : `lines ${snapshot.startLine}-${snapshot.endLine}`;

  return [
    `Reference ${reference.text} — raw request body "${snapshot.label}".`,
    `Selected raw body text (characters ${snapshot.startOffset}–${snapshot.endOffset}, ${lineSpan}):`,
    '```text',
    snapshot.selectedText,
    '```',
    'Call get_active_request_details when you need the full body (including body_raw / body_raw_effective). Use update_active_request with body_raw to replace the raw body text.'
  ].join('\n');
}

/**
 * Inserts visible, non-source markers around a selected script range.
 *
 * @param source - Full script source.
 * @param startOffset - Inclusive selection start.
 * @param endOffset - Exclusive selection end.
 * @returns Full source with the selected span visibly delimited.
 */
function markScriptSelection(source: string, startOffset: number, endOffset: number): string {
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
function describeScriptSelectionShape(
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
 * Formats one request-script selection from a click-time snapshot for the agent context block.
 *
 * @param reference - Parsed request-script reference with a character-range suffix.
 * @param snapshot - Captured script source and selection from Copy to chat.
 * @returns Context block with full source and selected text.
 */
function formatScriptSelectionSnapshotContextBlock(
  reference: ParsedRequestScriptReference,
  snapshot: ScriptSelectionSnapshot
): string {
  const phaseLabel = snapshot.phase === 'pre' ? 'pre-request' : 'post-request';
  const requestLabel =
    snapshot.requestId === 'active'
      ? 'of the active request'
      : `of request id ${snapshot.requestId}`;
  const lineSpan =
    snapshot.startLine === snapshot.endLine
      ? `line ${snapshot.startLine}`
      : `lines ${snapshot.startLine}-${snapshot.endLine}`;
  const markedSource = markScriptSelection(
    snapshot.source,
    snapshot.startOffset,
    snapshot.endOffset
  );

  const lines = [
    `Reference ${reference.text} — script "${snapshot.scriptLabel}" (${phaseLabel} script ${snapshot.scriptIndex} ${requestLabel}).`,
    'Full script source with selection markers (<<<SEL>>> and <<</SEL>>> are context markers, not source code):',
    '```js',
    markedSource,
    '```',
    `Selected text (characters ${snapshot.startOffset}–${snapshot.endOffset}, ${lineSpan}):`,
    '```js',
    snapshot.selectedText,
    '```',
    describeScriptSelectionShape(snapshot.source, snapshot.startOffset, snapshot.endOffset)
  ];

  if (snapshot.lastRunFailure) {
    lines.push(...formatScriptSelectionLastRunFailureBlock(snapshot.lastRunFailure));
  }

  return lines.join('\n');
}

/**
 * Formats a last-run failure section for an @ script selection context block.
 *
 * @param failure - Captured script error or failed test for the selected slot.
 * @returns Context lines describing the failure for the agent.
 */
function formatScriptSelectionLastRunFailureBlock(
  failure: ScriptSelectionLastRunFailure
): string[] {
  const kindLabel =
    failure.kind === 'test-failure' ? 'Failed hc.test result' : 'Script runtime error';
  const lines = ['Last run error:', `${kindLabel}: ${failure.message}`];
  if (failure.testName) {
    lines.push(`Test name: ${failure.testName}`);
  }
  if (failure.expected != null || failure.actual != null) {
    const parts: string[] = [];
    if (failure.expected != null) {
      parts.push(`expected ${failure.expected}`);
    }
    if (failure.actual != null) {
      parts.push(`got ${failure.actual}`);
    }
    lines.push(parts.join(', '));
  }
  if (failure.line != null) {
    const source = failure.source?.trim() || 'script.js';
    const location =
      failure.column != null
        ? `${source}:${failure.line}:${failure.column}`
        : `${source}:${failure.line}`;
    lines.push(`Location: ${location}`);
  }
  return lines;
}

function formatScriptSelectionContextBlock(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (reference.kind === 'terminal') {
    return formatTerminalSelectionContextBlock(reference, context);
  }

  if (reference.kind === 'logs') {
    return formatLogsSelectionContextBlock(reference, context);
  }

  if (reference.kind === 'markdown') {
    return formatMarkdownSelectionContextBlock(reference, context);
  }

  if (reference.kind === 'body') {
    return formatRequestBodySelectionContextBlock(reference, context);
  }

  if (reference.kind === 'response-section') {
    return formatResponseSectionContextBlock(reference, context);
  }

  if (reference.selection == null || !isValidAiScriptReference(reference, context)) {
    return null;
  }

  if (reference.kind === 'request-script') {
    const snapshot = context.scriptSelections?.[reference.text];
    if (snapshot != null) {
      return formatScriptSelectionSnapshotContextBlock(reference, snapshot);
    }
  }

  const source = resolveReferenceSourceCode(reference, context);
  if (source == null) {
    return null;
  }

  const name = resolveAiScriptReferenceName(reference, context) ?? 'Unnamed script';
  const clampedSelection = clampScriptSelection(source, reference.selection);
  const lineSpan = formatScriptSelectionLineSpan(source, clampedSelection);
  const markedSource = markScriptSelection(source, clampedSelection.start, clampedSelection.end);
  const selectionShape = describeScriptSelectionShape(
    source,
    clampedSelection.start,
    clampedSelection.end
  );

  if (reference.kind === 'snippet') {
    return [
      `Reference ${reference.text} — standalone library snippet "${name}" (not linked to any specific request).`,
      'Full snippet source with selection markers (<<<SEL>>> and <<</SEL>>> are context markers, not source code):',
      '```js',
      markedSource,
      '```',
      `Selected text (characters ${clampedSelection.start}–${clampedSelection.end}, ${lineSpan}):`,
      '```js',
      clampedSelection.text,
      '```',
      selectionShape
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
    'Full script source with selection markers (<<<SEL>>> and <<</SEL>>> are context markers, not source code):',
    '```js',
    markedSource,
    '```',
    `Selected text (characters ${clampedSelection.start}–${clampedSelection.end}, ${lineSpan}):`,
    '```js',
    clampedSelection.text,
    '```',
    selectionShape
  ].join('\n');
}

/**
 * Formats one valid whole-script `@` reference (no `#selection` suffix) for agent context.
 *
 * @param reference - Parsed `@` script reference without a selection range.
 * @param context - Active tab script rows and snippet library.
 * @returns Context block with full script source, or null when not resolvable.
 */
function formatWholeScriptReferenceContextBlock(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (
    reference.selection != null ||
    reference.kind === 'terminal' ||
    reference.kind === 'logs' ||
    reference.kind === 'markdown' ||
    reference.kind === 'body' ||
    reference.kind === 'response-section' ||
    reference.kind === 'collection' ||
    reference.kind === 'folder' ||
    reference.kind === 'request' ||
    reference.kind === 'webpage' ||
    reference.kind === 'live-server' ||
    reference.kind === 'plugin'
  ) {
    return null;
  }

  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  const source = resolveReferenceSourceCode(reference, context);
  if (source == null) {
    return null;
  }

  const name = resolveAiScriptReferenceName(reference, context) ?? 'Unnamed script';

  if (reference.kind === 'snippet') {
    return [
      `Reference ${reference.text} — standalone library snippet "${name}" (not linked to any specific request).`,
      'Full snippet source:',
      '```js',
      source,
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
    '```'
  ].join('\n');
}

/**
 * Formats one resolved `@webpage` reference for the agent context block.
 *
 * @param reference - Parsed `@webpage.<tabId>` reference (optional `#x.y` click).
 * @param context - Open browser tabs keyed by tab id.
 * @returns Context block for one webpage reference, or null when not resolvable.
 */
function formatWebpageReferenceContextBlock(
  reference: ParsedWebpageReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  const tab = context.webpageTabsById?.[reference.tabId];
  if (tab == null) {
    return null;
  }

  const title = tab.title.trim().length > 0 ? tab.title.trim() : '(untitled)';

  const lines = [
    `Reference ${reference.text} — embedded browser tab "${title}".`,
    `tabId: ${reference.tabId}`,
    `url: ${tab.url}`
  ];

  if (reference.click != null) {
    const { x, y } = reference.click;
    lines.push(
      `click: ${x},${y} (viewport CSS pixels)`,
      `Resolve the user's focus with webpage_evaluate on this tabId using document.elementFromPoint(${x}, ${y}). Summarize the element's tag, id, className, attributes, textContent, and outerHTML (cap large HTML), then use other webpage_* tools as needed.`
    );
  } else {
    lines.push(
      'Call webpage_tab (and webpage_query / webpage_evaluate / webpage_inject_script / webpage_inject_stylesheet) with this exact tabId for live page operations.'
    );
  }

  return lines.join('\n');
}

/**
 * Formats one resolved `@live-server` reference for the agent context block.
 *
 * @param reference - Parsed `@live-server.<uuid>` reference.
 * @param context - Saved live servers keyed by uuid.
 * @returns Context block for one live-server reference, or null when not resolvable.
 */
function formatLiveServerReferenceContextBlock(
  reference: ParsedLiveServerReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  const server = context.liveServersByUuid?.[reference.liveServerUuid];
  if (server == null) {
    return null;
  }

  const lines = [
    `Reference ${reference.text} — live server "${server.name}".`,
    `uuid: ${reference.liveServerUuid}`,
    `id: ${server.id}`,
    `root: ${server.root}`,
    `configuredPort: ${server.port == null ? 'auto' : String(server.port)}`,
    `watch: ${server.watch ? 'true' : 'false'}`
  ];

  if (server.origin != null && server.runtimeId != null) {
    lines.push(
      `status: running`,
      `runtimeId: ${server.runtimeId}`,
      `origin: ${server.origin}`,
      `runningPort: ${server.runningPort ?? 'unknown'}`,
      'Call get_live_server, list_running_live_servers, and get_live_server_logs as needed. Use webpage_* with this origin to inspect the served page.'
    );
  } else {
    lines.push(
      'status: stopped',
      'Call get_live_server and list_running_live_servers as needed. Only call start_live_server when the user explicitly asks to start it.'
    );
  }

  return lines.join('\n');
}

/**
 * Formats one resolved `@logs` reference (whole buffer or selection) for the agent context block.
 *
 * @param reference - Parsed `@logs.<uuid>` reference.
 * @param context - Saved live servers and optional log selection snapshots.
 * @returns Context block for one logs reference, or null when not resolvable.
 */
function formatLogsReferenceContextBlock(
  reference: ParsedLogsReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  if (reference.selection != null) {
    return formatLogsSelectionContextBlock(reference, context);
  }

  const server = context.liveServersByUuid?.[reference.liveServerUuid];
  if (server == null) {
    return null;
  }

  const lines = [
    `Reference ${reference.text} — live server access logs for "${server.name}".`,
    `uuid: ${reference.liveServerUuid}`,
    `id: ${server.id}`,
    `root: ${server.root}`,
    `configuredPort: ${server.port == null ? 'auto' : String(server.port)}`
  ];

  if (server.origin != null && server.runtimeId != null) {
    lines.push(
      `status: running`,
      `runtimeId: ${server.runtimeId}`,
      `origin: ${server.origin}`,
      `runningPort: ${server.runningPort ?? 'unknown'}`
    );
  } else {
    lines.push('status: stopped');
  }

  lines.push(
    'Call get_live_server with this uuid and get_live_server_logs with the saved id to read current access logs. Only call clear_live_server_logs when the user explicitly asks.'
  );

  return lines.join('\n');
}

/**
 * Formats one resolved plugin chat-pointer reference for the agent context block.
 *
 * @param reference - Parsed `@plugin…` reference.
 * @param context - Plugin selection snapshots keyed by reference token.
 * @returns Context block for one plugin reference, or null when not resolvable.
 */
function formatPluginChatPointerContextBlock(
  reference: ParsedPluginReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  const snapshot = context.pluginSelections?.[reference.text];
  if (snapshot == null) {
    return null;
  }

  const lines = [
    `Reference ${reference.text} — plugin chat pointer "${snapshot.label}" (plugin ${snapshot.pluginId}, pointer ${snapshot.pointerId}).`,
    'Captured plugin context:',
    '```text',
    snapshot.context,
    '```'
  ];

  if (reference.selection != null) {
    lines.push(
      `Focus on the selected region (characters ${reference.selection.start}–${reference.selection.end}) when answering.`
    );
  }

  return lines.join('\n');
}

/**
 * Formats agent context for one `@` script reference, with or without a selection suffix.
 *
 * @param reference - Parsed `@` script reference.
 * @param context - Active tab script rows and snippet library.
 */
function formatScriptReferenceContextBlock(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): string | null {
  if (reference.kind === 'plugin') {
    return formatPluginChatPointerContextBlock(reference, context);
  }

  if (reference.kind === 'webpage') {
    return formatWebpageReferenceContextBlock(reference, context);
  }

  if (reference.kind === 'live-server') {
    return formatLiveServerReferenceContextBlock(reference, context);
  }

  if (reference.kind === 'logs') {
    return formatLogsReferenceContextBlock(reference, context);
  }

  if (reference.kind === 'response-section') {
    return formatResponseSectionContextBlock(reference, context);
  }

  if (reference.selection != null) {
    return formatScriptSelectionContextBlock(reference, context);
  }

  return formatWholeScriptReferenceContextBlock(reference, context);
}

/**
 * Builds an ephemeral system message that expands valid `@` script references in the user message.
 *
 * References with a `#start.end` suffix include the selected substring; whole-script references
 * include the full source so the model can answer questions without relying on tool calls alone.
 *
 * The returned text is injected into the LLM step messages only; it is not persisted in chat
 * history so the composer can keep rendering compact badges.
 *
 * @param text - User message that may contain `@` script references.
 * @param context - Active tab script rows and snippet library.
 * @returns Formatted context block, or null when no valid references are present.
 */
export function buildAiScriptSelectionContextMessage(
  text: string,
  context: AiScriptReferenceValidationContext
): string | null {
  const candidates = findAiScriptReferenceCandidates(text);
  const resolved = candidates
    .map((reference) => ({
      reference,
      block: formatScriptReferenceContextBlock(reference, context)
    }))
    .filter((entry): entry is { reference: ParsedAiScriptReference; block: string } =>
      entry.block != null ? true : false
    );

  if (resolved.length === 0) {
    return null;
  }

  const blocks = resolved.map((entry) => entry.block);

  const hasTerminalSelection = resolved.some(
    (entry) => entry.reference.kind === 'terminal' && entry.reference.selection != null
  );
  const hasLogsSelection = resolved.some(
    (entry) => entry.reference.kind === 'logs' && entry.reference.selection != null
  );
  const hasWholeLogsReference = resolved.some(
    (entry) => entry.reference.kind === 'logs' && entry.reference.selection == null
  );
  const hasMarkdownSelection = resolved.some(
    (entry) => entry.reference.kind === 'markdown' && entry.reference.selection != null
  );
  const hasBodySelection = resolved.some(
    (entry) => entry.reference.kind === 'body' && entry.reference.selection != null
  );
  const hasResponseBodySelection = resolved.some(
    (entry) =>
      entry.reference.kind === 'response-section' &&
      entry.reference.section === 'body' &&
      entry.reference.selection != null
  );
  const hasScriptSelection = resolved.some(
    (entry) =>
      (entry.reference.kind === 'request-script' || entry.reference.kind === 'snippet') &&
      entry.reference.selection != null
  );
  const hasWholeScriptReference = resolved.some(
    (entry) =>
      (entry.reference.kind === 'request-script' || entry.reference.kind === 'snippet') &&
      entry.reference.selection == null
  );
  const hasResponseSection = resolved.some((entry) => entry.reference.kind === 'response-section');
  const hasWholeResponseSection = resolved.some(
    (entry) => entry.reference.kind === 'response-section' && entry.reference.selection == null
  );
  const hasPluginReference = resolved.some((entry) => entry.reference.kind === 'plugin');

  const headerParts: string[] = [];
  if (hasTerminalSelection) {
    headerParts.push(
      'The user selected terminal output and is asking specifically about the SELECTED TEXT below.'
    );
  }
  if (hasLogsSelection) {
    headerParts.push(
      'The user selected live-server access-log lines and is asking specifically about the SELECTED TEXT below.'
    );
  }
  if (hasWholeLogsReference) {
    headerParts.push(
      'The user referenced live-server access logs via @logs mentions. Use the log context below and call get_live_server_logs when you need more lines.'
    );
  }
  if (hasMarkdownSelection) {
    headerParts.push(
      'The user selected markdown text and is asking specifically about the SELECTED TEXT below.'
    );
  }
  if (hasBodySelection) {
    headerParts.push(
      'The user selected raw request body text and is asking specifically about the SELECTED TEXT below.'
    );
  }
  if (hasResponseBodySelection) {
    headerParts.push(
      'The user selected part of an HTTP response body and is asking specifically about the SELECTED TEXT below.'
    );
  }
  if (hasScriptSelection) {
    headerParts.push(
      'The user selected part of a script and is asking specifically about the SELECTED TEXT below.'
    );
  }
  if (hasWholeScriptReference) {
    headerParts.push(
      'The user referenced one or more scripts via @ mentions. Use the script sources below to answer their question.'
    );
  }
  if (hasWholeResponseSection) {
    headerParts.push(
      'The user referenced one or more HTTP response sections via @res mentions. Use the captured section content below to answer their question.'
    );
  }
  if (hasPluginReference) {
    headerParts.push(
      'The user referenced one or more plugin chat pointers via @plugin mentions. Use the captured plugin context below to answer their question.'
    );
  }

  const footerParts: string[] = [];
  if (hasScriptSelection) {
    footerParts.push('Focus your answer on the selected region.');
  } else if (hasResponseBodySelection) {
    footerParts.push(
      'Focus your answer on the selected response body region. Call get_active_request and get_active_request_details for the full request; call get_active_response_summary, get_active_response, or query_response_body when you need more of the live response or non-binary body.'
    );
  } else if (hasBodySelection) {
    footerParts.push(
      'Focus your answer on the selected raw body region. Call get_active_request_details when you need the full body, and use update_active_request with body_raw to edit it.'
    );
  } else if (hasMarkdownSelection) {
    footerParts.push(
      'Focus your answer on the selected markdown region. Call get_markdown_document when you need the full document or comment source.'
    );
  } else if (hasWholeScriptReference) {
    footerParts.push('Answer using the referenced script source below.');
  }

  if (hasTerminalSelection) {
    footerParts.push(
      'Terminal output references cannot be edited via tools. Explain, diagnose, or suggest shell commands the user can run.'
    );
  }
  if (hasLogsSelection || hasWholeLogsReference) {
    footerParts.push(
      'Access-log references cannot be edited via tools. Explain or diagnose traffic using the captured lines and get_live_server_logs as needed.'
    );
  }

  if (hasMarkdownSelection) {
    footerParts.push(
      'Markdown documents and request comments referenced with @markdown.<uuid> cannot be edited via tools. Propose replacement markdown in your reply for the user to paste back into the editor.'
    );
  }

  if (hasBodySelection) {
    footerParts.push(
      'Raw body selections referenced with @body#start.end can be edited via update_active_request with body_raw (verbatim wire text for multipart/urlencoded). Prefer body_raw over structured body when the user is editing the Raw body drawer.'
    );
  }

  if (resolved.some((entry) => entry.reference.kind === 'request-script')) {
    footerParts.push(
      hasScriptSelection
        ? 'To edit only the selected region, call update_request_script with mode "replace_range", startOffset/endOffset from the @ #start.end tag, and code set to a drop-in replacement for exactly that span. Text outside the selection markers remains unchanged, so mentally concatenate the text before the selection + replacement code + text after the selection and confirm the result is valid JavaScript. Do not remove code outside the selection (other hc.test blocks, comments, or statements must stay). For a structural change or any replacement that is not syntactically substitutable, use mode "replace" with the entire script and all unchanged lines preserved.'
        : 'When editing request scripts, use update_request_script with the same phase and scriptIndex from the @ reference. Prefer mode "replace_range" for localized fixes; if using mode "replace", code must be the entire script — never overwrite with only a fixed snippet.'
    );
  }

  if (resolved.some((entry) => entry.reference.kind === 'snippet')) {
    footerParts.push(
      'Standalone library snippets referenced with @snippet.<uuid> cannot be edited via tools. Propose replacement code in your reply for the user to paste back into the snippet editor.'
    );
  }

  if (hasResponseSection) {
    footerParts.push(
      hasResponseBodySelection
        ? 'Response body selections referenced with @res.<tab-uuid>.body#start.end cannot be edited via tools. Offsets are into the pretty-printed body viewer text. Prefer the selected text in context; call get_active_request / get_active_request_details and get_active_response_summary / get_active_response / query_response_body when you need the full live request or response.'
        : 'Response-section references (@res.<tab-uuid>.<section>) cannot be edited via tools. Answer from the captured content; call get_active_request / get_active_request_details and get_active_response_summary / get_active_response / query_response_body only when you need more detail than the snapshot provides.'
    );
  }

  return [headerParts.join(' '), '', ...blocks, '', footerParts.join(' ')].join('\n');
}

/**
 * Builds a script-selection snapshot for a valid request-script reference from live context.
 *
 * Whole-script references store the full source as the "selection" so badges and later
 * rehydration do not depend on the active request tab still matching the token.
 *
 * @param reference - Valid request-script reference.
 * @param context - Active tab script rows and existing selection snapshots.
 * @returns Snapshot ready to persist, or null when source/label cannot be resolved.
 */
function buildRequestScriptSnapshotForPersistence(
  reference: ParsedRequestScriptReference,
  context: AiScriptReferenceValidationContext
): ScriptSelectionSnapshot | null {
  const existing = context.scriptSelections?.[reference.text];
  if (existing != null) {
    return existing;
  }

  const source = resolveReferenceSourceCode(reference, context);
  if (source == null) {
    return null;
  }

  const scriptLabel = resolveAiScriptReferenceName(reference, context);
  if (scriptLabel == null) {
    return null;
  }

  if (reference.selection != null) {
    const clamped = clampScriptSelection(source, reference.selection);
    return {
      scriptLabel,
      phase: reference.phase,
      scriptIndex: reference.scriptIndex,
      requestId: reference.requestId,
      source,
      selectedText: clamped.text,
      startOffset: clamped.start,
      endOffset: clamped.end,
      startLine: lineNumberAtOffset(source, clamped.start),
      endLine: lineNumberAtOffset(source, Math.max(clamped.start, clamped.end - 1))
    };
  }

  return {
    scriptLabel,
    phase: reference.phase,
    scriptIndex: reference.scriptIndex,
    requestId: reference.requestId,
    source,
    selectedText: source,
    startOffset: 0,
    endOffset: source.length,
    startLine: 1,
    endLine: lineNumberAtOffset(source, Math.max(0, source.length - 1))
  };
}

/**
 * Collects snapshot payloads for valid `@` references in chat text so badges can be
 * rehydrated after restart without relying on ephemeral Redux selection slices.
 *
 * Snapshot-backed kinds (`@res`, `@term`, `@markdown`, `@body`, request-script) are included.
 * Snippet, collection, folder, and request references resolve from library/sidebar state and
 * are omitted.
 *
 * @param text - User message that may contain `@` references.
 * @param context - Validation context with live tab state and ephemeral snapshots.
 * @returns Token-keyed snapshot map, or undefined when nothing needs persisting.
 */
export function collectChatReferenceSnapshots(
  text: string,
  context: AiScriptReferenceValidationContext
): PersistedChatReferenceSnapshots | undefined {
  const snapshots: PersistedChatReferenceSnapshots = {};

  for (const reference of findAiScriptReferenceCandidates(text)) {
    if (!isValidAiScriptReference(reference, context)) {
      continue;
    }

    if (reference.kind === 'response-section') {
      const snapshot = context.responseSelections?.[reference.text];
      if (snapshot != null) {
        snapshots[reference.text] = { kind: 'response-section', snapshot };
      }
      continue;
    }

    if (reference.kind === 'terminal') {
      const snapshot = context.terminalSelections?.[reference.text];
      if (snapshot != null) {
        snapshots[reference.text] = { kind: 'terminal', snapshot };
      }
      continue;
    }

    if (reference.kind === 'logs') {
      const snapshot = context.logsSelections?.[reference.text];
      if (snapshot != null) {
        snapshots[reference.text] = { kind: 'logs', snapshot };
      }
      continue;
    }

    if (reference.kind === 'markdown') {
      const snapshot = context.markdownSelections?.[reference.text];
      if (snapshot != null) {
        snapshots[reference.text] = { kind: 'markdown', snapshot };
      }
      continue;
    }

    if (reference.kind === 'body') {
      const snapshot = context.requestBodySelections?.[reference.text];
      if (snapshot != null) {
        snapshots[reference.text] = { kind: 'body', snapshot };
      }
      continue;
    }

    if (reference.kind === 'plugin') {
      const snapshot = context.pluginSelections?.[reference.text];
      if (snapshot != null) {
        snapshots[reference.text] = { kind: 'plugin', snapshot };
      }
      continue;
    }

    if (reference.kind === 'request-script') {
      const snapshot = buildRequestScriptSnapshotForPersistence(reference, context);
      if (snapshot != null) {
        snapshots[reference.text] = { kind: 'script-selection', snapshot };
      }
    }
  }

  return Object.keys(snapshots).length > 0 ? snapshots : undefined;
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

/**
 * Collects a single persistable snapshot entry for one validated reference.
 *
 * @param reference - Parsed `@` reference.
 * @param context - Validation context with ephemeral snapshots.
 * @returns Snapshot entry, or null when this kind does not persist.
 */
function collectSnapshotForPointer(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): PersistedChatReferenceSnapshotEntry | null {
  if (!isValidAiScriptReference(reference, context)) {
    return null;
  }

  if (reference.kind === 'response-section') {
    const snapshot = context.responseSelections?.[reference.text];
    return snapshot != null ? { kind: 'response-section', snapshot } : null;
  }
  if (reference.kind === 'terminal') {
    const snapshot = context.terminalSelections?.[reference.text];
    return snapshot != null ? { kind: 'terminal', snapshot } : null;
  }
  if (reference.kind === 'logs') {
    const snapshot = context.logsSelections?.[reference.text];
    return snapshot != null ? { kind: 'logs', snapshot } : null;
  }
  if (reference.kind === 'markdown') {
    const snapshot = context.markdownSelections?.[reference.text];
    return snapshot != null ? { kind: 'markdown', snapshot } : null;
  }
  if (reference.kind === 'body') {
    const snapshot = context.requestBodySelections?.[reference.text];
    return snapshot != null ? { kind: 'body', snapshot } : null;
  }
  if (reference.kind === 'plugin') {
    const snapshot = context.pluginSelections?.[reference.text];
    return snapshot != null ? { kind: 'plugin', snapshot } : null;
  }
  if (reference.kind === 'request-script') {
    const snapshot = buildRequestScriptSnapshotForPersistence(reference, context);
    return snapshot != null ? { kind: 'script-selection', snapshot } : null;
  }

  return null;
}

bindBuiltinChatPointerHandlers({
  validate: isValidAiScriptReference,
  resolveName: resolveAiScriptReferenceName,
  resolveLabel: resolveAiScriptReferenceLabel,
  expandContext: formatScriptReferenceContextBlock,
  collectSnapshot: collectSnapshotForPointer
});
refreshAiScriptReferencePattern();
